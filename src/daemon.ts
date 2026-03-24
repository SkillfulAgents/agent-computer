import { spawn } from 'child_process';
import { connect } from 'net';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { AC_DIR, SOCKET_PATH, DAEMON_JSON_PATH, IS_NAMED_PIPE } from './platform/index.js';
import { resolveBinary } from './platform/resolve.js';

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  socket?: string;
  started_at?: string;
  uptime_ms?: number;
}

interface DaemonInfo {
  pid: number;
  socket: string;
  started_at: string;
}

export class DaemonManager {
  private binaryPath: string;

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? resolveBinary();
  }

  async start(): Promise<DaemonStatus> {
    // Check if already running
    const current = this.readDaemonInfo();
    if (current && this.isProcessAlive(current.pid)) {
      return this.buildStatus(current, true);
    }

    // Clean up stale files
    this.cleanupStale();

    // Spawn daemon
    mkdirSync(AC_DIR, { recursive: true });
    const proc = spawn(this.binaryPath, ['--daemon'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.unref();

    // Wait for daemon to be ready
    const start = Date.now();
    if (IS_NAMED_PIPE) {
      // Named pipes: wait for daemon.json to appear (pipe has no file)
      while (Date.now() - start < 5000) {
        if (existsSync(DAEMON_JSON_PATH)) {
          await sleep(50);
          break;
        }
        await sleep(50);
      }
      if (!existsSync(DAEMON_JSON_PATH)) {
        throw new Error('Daemon failed to start: daemon.json not created within 5s');
      }
    } else {
      // Unix socket: wait for socket file to appear
      while (Date.now() - start < 5000) {
        if (existsSync(SOCKET_PATH)) {
          await sleep(50);
          break;
        }
        await sleep(50);
      }
      if (!existsSync(SOCKET_PATH)) {
        throw new Error('Daemon failed to start: socket not created within 5s');
      }
    }

    const info = this.readDaemonInfo();
    if (!info) {
      throw new Error('Daemon started but daemon.json not found');
    }

    return this.buildStatus(info, true);
  }

  async stop(): Promise<void> {
    const info = this.readDaemonInfo();
    if (!info) return;

    if (this.isProcessAlive(info.pid)) {
      // On Windows, SIGTERM is a hard kill — try graceful RPC shutdown first
      if (IS_NAMED_PIPE) {
        try {
          await this.sendShutdownRPC(info.socket);
        } catch { /* fall through to SIGTERM */ }
      }

      // Wait for process to exit (may already be gone from RPC shutdown)
      let start = Date.now();
      while (Date.now() - start < 3000) {
        if (!this.isProcessAlive(info.pid)) break;
        await sleep(50);
      }

      // Send SIGTERM if still alive
      if (this.isProcessAlive(info.pid)) {
        try {
          process.kill(info.pid, 'SIGTERM');
        } catch { /* ok */ }

        start = Date.now();
        while (Date.now() - start < 3000) {
          if (!this.isProcessAlive(info.pid)) break;
          await sleep(50);
        }
      }

      // Force kill if still alive
      if (this.isProcessAlive(info.pid)) {
        try {
          process.kill(info.pid, 'SIGKILL');
        } catch { /* ok */ }
      }
    }

    this.cleanupStale();
  }

  private sendShutdownRPC(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = connect({ path: socketPath });
      const timeout = setTimeout(() => { sock.destroy(); reject(new Error('shutdown timeout')); }, 2000);
      sock.on('connect', () => {
        const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'shutdown', params: {} }) + '\n';
        sock.write(req, () => {
          clearTimeout(timeout);
          // Give daemon a moment to process before closing
          setTimeout(() => { sock.destroy(); resolve(); }, 100);
        });
      });
      sock.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
  }

  async status(): Promise<DaemonStatus> {
    const info = this.readDaemonInfo();
    if (!info) {
      return { running: false };
    }

    const alive = this.isProcessAlive(info.pid);
    if (!alive) {
      this.cleanupStale();
      return { running: false };
    }

    return this.buildStatus(info, true);
  }

  async restart(): Promise<DaemonStatus> {
    await this.stop();
    return this.start();
  }

  private readDaemonInfo(): DaemonInfo | null {
    try {
      if (!existsSync(DAEMON_JSON_PATH)) return null;
      const raw = readFileSync(DAEMON_JSON_PATH, 'utf-8');
      return JSON.parse(raw) as DaemonInfo;
    } catch {
      return null;
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupStale(): void {
    if (!IS_NAMED_PIPE) {
      try { unlinkSync(SOCKET_PATH); } catch { /* ok */ }
    }
    try { unlinkSync(DAEMON_JSON_PATH); } catch { /* ok */ }
  }

  private buildStatus(info: DaemonInfo, running: boolean): DaemonStatus {
    const startedAt = new Date(info.started_at);
    const uptime = Date.now() - startedAt.getTime();
    return {
      running,
      pid: info.pid,
      socket: info.socket,
      started_at: info.started_at,
      uptime_ms: Math.max(0, uptime),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
