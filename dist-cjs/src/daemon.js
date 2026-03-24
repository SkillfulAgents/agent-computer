"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DaemonManager = void 0;
const child_process_1 = require("child_process");
const net_1 = require("net");
const fs_1 = require("fs");
const index_js_1 = require("./platform/index.js");
const resolve_js_1 = require("./platform/resolve.js");
class DaemonManager {
    binaryPath;
    constructor(binaryPath) {
        this.binaryPath = binaryPath ?? (0, resolve_js_1.resolveBinary)();
    }
    async start() {
        // Check if already running
        const current = this.readDaemonInfo();
        if (current && this.isProcessAlive(current.pid)) {
            return this.buildStatus(current, true);
        }
        // Clean up stale files
        this.cleanupStale();
        // Spawn daemon
        (0, fs_1.mkdirSync)(index_js_1.AC_DIR, { recursive: true });
        const proc = (0, child_process_1.spawn)(this.binaryPath, ['--daemon'], {
            detached: true,
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        proc.unref();
        // Wait for daemon to be ready
        const start = Date.now();
        if (index_js_1.IS_NAMED_PIPE) {
            // Named pipes: wait for daemon.json to appear (pipe has no file)
            while (Date.now() - start < 5000) {
                if ((0, fs_1.existsSync)(index_js_1.DAEMON_JSON_PATH)) {
                    await sleep(50);
                    break;
                }
                await sleep(50);
            }
            if (!(0, fs_1.existsSync)(index_js_1.DAEMON_JSON_PATH)) {
                throw new Error('Daemon failed to start: daemon.json not created within 5s');
            }
        }
        else {
            // Unix socket: wait for socket file to appear
            while (Date.now() - start < 5000) {
                if ((0, fs_1.existsSync)(index_js_1.SOCKET_PATH)) {
                    await sleep(50);
                    break;
                }
                await sleep(50);
            }
            if (!(0, fs_1.existsSync)(index_js_1.SOCKET_PATH)) {
                throw new Error('Daemon failed to start: socket not created within 5s');
            }
        }
        const info = this.readDaemonInfo();
        if (!info) {
            throw new Error('Daemon started but daemon.json not found');
        }
        return this.buildStatus(info, true);
    }
    async stop() {
        const info = this.readDaemonInfo();
        if (!info)
            return;
        if (this.isProcessAlive(info.pid)) {
            // On Windows, SIGTERM is a hard kill — try graceful RPC shutdown first
            if (index_js_1.IS_NAMED_PIPE) {
                try {
                    await this.sendShutdownRPC(info.socket);
                }
                catch { /* fall through to SIGTERM */ }
            }
            // Wait for process to exit (may already be gone from RPC shutdown)
            let start = Date.now();
            while (Date.now() - start < 3000) {
                if (!this.isProcessAlive(info.pid))
                    break;
                await sleep(50);
            }
            // Send SIGTERM if still alive
            if (this.isProcessAlive(info.pid)) {
                try {
                    process.kill(info.pid, 'SIGTERM');
                }
                catch { /* ok */ }
                start = Date.now();
                while (Date.now() - start < 3000) {
                    if (!this.isProcessAlive(info.pid))
                        break;
                    await sleep(50);
                }
            }
            // Force kill if still alive
            if (this.isProcessAlive(info.pid)) {
                try {
                    process.kill(info.pid, 'SIGKILL');
                }
                catch { /* ok */ }
            }
        }
        this.cleanupStale();
    }
    sendShutdownRPC(socketPath) {
        return new Promise((resolve, reject) => {
            const sock = (0, net_1.connect)({ path: socketPath });
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
    async status() {
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
    async restart() {
        await this.stop();
        return this.start();
    }
    readDaemonInfo() {
        try {
            if (!(0, fs_1.existsSync)(index_js_1.DAEMON_JSON_PATH))
                return null;
            const raw = (0, fs_1.readFileSync)(index_js_1.DAEMON_JSON_PATH, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    isProcessAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    cleanupStale() {
        if (!index_js_1.IS_NAMED_PIPE) {
            try {
                (0, fs_1.unlinkSync)(index_js_1.SOCKET_PATH);
            }
            catch { /* ok */ }
        }
        try {
            (0, fs_1.unlinkSync)(index_js_1.DAEMON_JSON_PATH);
        }
        catch { /* ok */ }
    }
    buildStatus(info, running) {
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
exports.DaemonManager = DaemonManager;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
