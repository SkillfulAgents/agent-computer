import { connect, type Socket } from 'net';
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { errorFromCode, ACError, TimeoutError } from './errors.js';
import { SOCKET_PATH, DAEMON_JSON_PATH, AC_DIR } from './platform/darwin.js';
import { resolveBinary } from './platform/resolve.js';

let nextId = 1;

// MARK: - JSON-RPC Message Types

export interface RPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface RPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

export function buildRequest(method: string, params: Record<string, unknown> = {}): RPCRequest {
  return {
    jsonrpc: '2.0',
    id: nextId++,
    method,
    params,
  };
}

export function parseResponse(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new Error('Invalid JSON-RPC response: expected an object');
  }

  const resp = raw as Record<string, unknown>;

  if (resp.jsonrpc !== '2.0') {
    throw new Error('Invalid JSON-RPC response: missing or incorrect "jsonrpc" field');
  }

  if (!('id' in resp)) {
    throw new Error('Invalid JSON-RPC response: missing "id" field');
  }

  if ('error' in resp && resp.error) {
    const err = resp.error as { code: number; message: string; data?: Record<string, unknown> };
    throw errorFromCode(err.code, err.message, err.data);
  }

  if ('result' in resp) {
    return resp.result;
  }

  throw new Error('Invalid JSON-RPC response: missing both "result" and "error"');
}

export function _resetIdCounter(): void {
  nextId = 1;
}

// MARK: - Bridge Class

export interface BridgeOptions {
  timeout?: number;
  binaryPath?: string;
}

interface DaemonInfo {
  pid: number;
  socket: string;
  started_at: string;
}

export class Bridge {
  private socket: Socket | null = null;
  private daemonProcess: ChildProcess | null = null;
  private binaryPath: string;
  private timeout: number;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private buffer = '';

  constructor(options: BridgeOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.binaryPath = options.binaryPath ?? resolveBinary();
  }

  // Send a JSON-RPC request and return the result
  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    // Ensure daemon is running and connected
    if (!this.socket || this.socket.destroyed) {
      await this.ensureDaemon();
    }

    const request = buildRequest(method, params);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new TimeoutError(`Command "${method}" timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.pendingRequests.set(request.id, { resolve, reject, timer });

      const line = JSON.stringify(request) + '\n';
      this.socket!.write(line, (err) => {
        if (err) {
          this.pendingRequests.delete(request.id);
          clearTimeout(timer);
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    });
  }

  // Send a JSON-RPC request via one-shot mode (exec binary per command)
  sendOneShot(method: string, params: Record<string, unknown> = {}): unknown {
    const request = buildRequest(method, params);
    const input = JSON.stringify(request);

    try {
      const stdout = execFileSync(this.binaryPath, [], {
        encoding: 'utf-8',
        input,
        timeout: this.timeout,
      }).trim();

      const raw = JSON.parse(stdout);
      return parseResponse(raw);
    } catch (err: any) {
      if (err instanceof ACError) throw err;
      // Try to parse error stdout
      if (err.stdout) {
        try {
          const raw = JSON.parse(err.stdout.trim());
          return parseResponse(raw);
        } catch { /* fall through */ }
      }
      throw new Error(`One-shot command failed: ${err.message}`);
    }
  }

  private async ensureDaemon(): Promise<void> {
    // Check if a daemon is already running
    const info = this.readDaemonInfo();
    if (info && this.isProcessAlive(info.pid)) {
      try {
        await this.connectToSocket(info.socket);
        return;
      } catch {
        // Socket exists but connection failed — daemon is dead
      }
    }

    // Clean up stale state
    this.cleanupStaleFiles();

    // Spawn new daemon
    await this.spawnDaemon();
    await this.waitForSocket();

    const newInfo = this.readDaemonInfo();
    if (!newInfo) {
      throw new Error('Daemon started but daemon.json not found');
    }
    await this.connectToSocket(newInfo.socket);
  }

  private async spawnDaemon(): Promise<void> {
    mkdirSync(AC_DIR, { recursive: true });

    this.daemonProcess = spawn(this.binaryPath, ['--daemon'], {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    this.daemonProcess.unref();

    // Log daemon stderr for debugging
    this.daemonProcess.stderr?.on('data', (data: Buffer) => {
      if (process.env.AC_VERBOSE === '1') {
        process.stderr.write(data);
      }
    });

    this.daemonProcess.on('exit', (code) => {
      if (process.env.AC_VERBOSE === '1') {
        process.stderr.write(`[bridge] daemon exited with code ${code}\n`);
      }
    });
  }

  private async waitForSocket(maxWait = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      if (existsSync(SOCKET_PATH)) {
        // Give the server a moment to start listening
        await sleep(50);
        return;
      }
      await sleep(50);
    }
    throw new Error(`Daemon socket did not appear within ${maxWait}ms`);
  }

  private connectToSocket(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = connect({ path: socketPath });
      const timeout = setTimeout(() => {
        sock.destroy();
        reject(new Error('Socket connection timed out'));
      }, 3000);

      sock.on('connect', () => {
        clearTimeout(timeout);
        this.socket = sock;
        this.buffer = '';
        this.setupSocketHandlers();
        resolve();
      });

      sock.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.socket.on('close', () => {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Socket closed'));
        this.pendingRequests.delete(id);
      }
      this.socket = null;
    });

    this.socket.on('error', (err) => {
      if (process.env.AC_VERBOSE === '1') {
        process.stderr.write(`[bridge] socket error: ${err.message}\n`);
      }
    });
  }

  private processBuffer(): void {
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx);
      this.buffer = this.buffer.slice(newlineIdx + 1);

      if (!line.trim()) continue;

      try {
        const raw = JSON.parse(line) as RPCResponse;
        const pending = this.pendingRequests.get(raw.id);
        if (pending) {
          this.pendingRequests.delete(raw.id);
          clearTimeout(pending.timer);
          try {
            const result = parseResponse(raw);
            pending.resolve(result);
          } catch (err) {
            pending.reject(err);
          }
        }
      } catch {
        // Malformed response — ignore
      }
    }
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

  private cleanupStaleFiles(): void {
    try { unlinkSync(SOCKET_PATH); } catch { /* ok */ }
    try { unlinkSync(DAEMON_JSON_PATH); } catch { /* ok */ }
  }

  isRunning(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  daemonPid(): number | null {
    const info = this.readDaemonInfo();
    return info?.pid ?? null;
  }

  async disconnect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async shutdown(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      try {
        await this.send('shutdown', {});
      } catch { /* ok — socket may close before response */ }
      await sleep(100);
    }
    this.socket?.destroy();
    this.socket = null;
  }

  // Kill the daemon process directly (for testing crash recovery)
  _killDaemonProcess(): void {
    const info = this.readDaemonInfo();
    if (info) {
      try {
        process.kill(info.pid, 'SIGKILL');
      } catch { /* ok */ }
    }
    this.socket?.destroy();
    this.socket = null;
  }

  // Send raw data directly to socket (for testing malformed input handling)
  _sendRawToSocket(data: string): void {
    this.socket?.write(data);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
