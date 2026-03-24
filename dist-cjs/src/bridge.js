"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bridge = void 0;
exports.buildRequest = buildRequest;
exports.parseResponse = parseResponse;
exports._resetIdCounter = _resetIdCounter;
const net_1 = require("net");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const errors_js_1 = require("./errors.js");
const index_js_1 = require("./platform/index.js");
const resolve_js_1 = require("./platform/resolve.js");
const client_js_1 = require("./cdp/client.js");
const port_manager_js_1 = require("./cdp/port-manager.js");
const discovery_js_1 = require("./cdp/discovery.js");
let nextId = 1;
// Methods that can be routed to CDP when a Chromium app is grabbed
const CDP_CAPABLE_METHODS = new Set([
    'snapshot', 'find', 'read', 'children', 'click', 'hover', 'focus',
    'type', 'fill', 'key', 'scroll', 'select', 'check', 'uncheck',
    'box', 'is', 'changed', 'diff',
]);
function buildRequest(method, params = {}) {
    return {
        jsonrpc: '2.0',
        id: nextId++,
        method,
        params,
    };
}
function parseResponse(raw) {
    if (raw === null || raw === undefined || typeof raw !== 'object') {
        throw new Error('Invalid JSON-RPC response: expected an object');
    }
    const resp = raw;
    if (resp.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC response: missing or incorrect "jsonrpc" field');
    }
    if (!('id' in resp)) {
        throw new Error('Invalid JSON-RPC response: missing "id" field');
    }
    if ('error' in resp && resp.error) {
        const err = resp.error;
        throw (0, errors_js_1.errorFromCode)(err.code, err.message, err.data);
    }
    if ('result' in resp) {
        return resp.result;
    }
    throw new Error('Invalid JSON-RPC response: missing both "result" and "error"');
}
function _resetIdCounter() {
    nextId = 1;
}
class Bridge {
    socket = null;
    daemonProcess = null;
    binaryPath;
    timeout;
    pendingRequests = new Map();
    buffer = '';
    bomChecked = false;
    // CDP routing state
    cdpClients = new Map(); // pid → CDPClient
    grabbedAppInfo = null;
    constructor(options = {}) {
        this.timeout = options.timeout ?? 10000;
        this.binaryPath = options.binaryPath ?? (0, resolve_js_1.resolveBinary)();
    }
    // Send a JSON-RPC request — routes to CDP or native daemon
    async send(method, params = {}) {
        // Special handlers
        if (method === 'launch')
            return this.handleLaunch(params);
        if (method === 'relaunch')
            return this.handleRelaunch(params);
        if (method === 'grab')
            return this.handleGrab(params);
        if (method === 'ungrab')
            return this.handleUngrab(params);
        if (method === 'batch')
            return this.handleBatch(params);
        if (method === 'wait')
            return this.handleWait(params);
        // Route to CDP if applicable
        if (CDP_CAPABLE_METHODS.has(method) && await this.ensureCDPIfNeeded()) {
            return this.sendToCDP(method, params);
        }
        return this.sendToNative(method, params);
    }
    // Send directly to the native daemon
    async sendToNative(method, params = {}) {
        // Ensure daemon is running and connected
        if (!this.socket || this.socket.destroyed) {
            await this.ensureDaemon();
        }
        const request = buildRequest(method, params);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(request.id);
                reject(new errors_js_1.TimeoutError(`Command "${method}" timed out after ${this.timeout}ms`));
            }, this.timeout);
            this.pendingRequests.set(request.id, { resolve, reject, timer });
            const line = JSON.stringify(request) + '\n';
            this.socket.write(line, (err) => {
                if (err) {
                    this.pendingRequests.delete(request.id);
                    clearTimeout(timer);
                    reject(new Error(`Failed to send command: ${err.message}`));
                }
            });
        });
    }
    // Send a JSON-RPC request via one-shot mode (exec binary per command)
    sendOneShot(method, params = {}) {
        const request = buildRequest(method, params);
        const input = JSON.stringify(request);
        try {
            const stdout = (0, child_process_1.execFileSync)(this.binaryPath, [], {
                encoding: 'utf-8',
                input,
                timeout: this.timeout,
            }).trim();
            const raw = JSON.parse(stdout);
            return parseResponse(raw);
        }
        catch (err) {
            if (err instanceof errors_js_1.ACError)
                throw err;
            // Try to parse error stdout (may contain BOM on Windows)
            const errOut = (err.stdout || err.output?.[1]?.toString() || '').replace(/^\uFEFF/, '').trim();
            if (errOut) {
                try {
                    const raw = JSON.parse(errOut);
                    return parseResponse(raw);
                }
                catch (parseErr) {
                    if (parseErr instanceof errors_js_1.ACError)
                        throw parseErr;
                    /* fall through */
                }
            }
            throw new Error(`One-shot command failed: ${err.message}`);
        }
    }
    /**
     * Lazily detect if the currently grabbed app has CDP available.
     * Checks live every time: asks daemon for grab state, checks if Chromium,
     * scans port range for a live CDP endpoint.
     */
    async ensureCDPIfNeeded() {
        // Already connected this session
        if (this.grabbedAppInfo?.isCDP)
            return true;
        // Ask the daemon what's grabbed (status includes app name and pid from cached window info)
        let status;
        try {
            status = await this.sendToNative('status');
        }
        catch {
            return false;
        }
        const app = status.grabbed_app;
        const pid = status.grabbed_pid;
        if (!app || !pid)
            return false;
        // Ask daemon for CDP port
        let port;
        try {
            const result = await this.sendToNative('cdp_port', { name: app });
            if (result.port)
                port = result.port;
        }
        catch {
            return false;
        }
        if (!port)
            return false;
        // Connect CDP client
        try {
            await (0, discovery_js_1.waitForCDP)(port, 3000);
            const client = new client_js_1.CDPClient(port);
            await client.connect();
            this.cdpClients.set(pid, client);
            this.grabbedAppInfo = { pid, isCDP: true, app };
            return true;
        }
        catch {
            return false;
        }
    }
    async sendToCDP(method, params) {
        const pid = this.grabbedAppInfo.pid;
        const client = this.cdpClients.get(pid);
        if (!client || !client.isConnected()) {
            throw new Error('CDP client not connected for grabbed app');
        }
        // For non-snapshot commands, ensure we have state from a previous snapshot
        if (method !== 'snapshot' && client.getLastRefMap().size === 0) {
            // First try loading the persisted refMap (fast, for click/hover/focus)
            try {
                const kv = await this.sendToNative('kv_get', { key: 'cdp_refmap' });
                if (kv.value && typeof kv.value === 'object') {
                    const map = client.getLastRefMap();
                    for (const [ref, nodeRef] of Object.entries(kv.value)) {
                        map.set(ref, nodeRef);
                    }
                }
            }
            catch { /* old daemon without kv_set */ }
            // For query commands that need full elements, take a fresh snapshot
            const NEEDS_ELEMENTS = new Set(['find', 'read', 'is', 'children', 'changed', 'diff']);
            if (NEEDS_ELEMENTS.has(method)) {
                const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo.app });
                const win = windowInfo.windows?.[0];
                if (win)
                    await client.snapshot({}, win);
            }
        }
        switch (method) {
            case 'snapshot': {
                // Get window info from native daemon
                const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo.app });
                const win = windowInfo.windows?.[0];
                if (!win)
                    throw new Error('No window found for grabbed CDP app');
                const snap = await client.snapshot({
                    interactive: params.interactive,
                    depth: params.depth,
                }, win);
                // Persist refMap to daemon so other CLI invocations can use it
                const serialized = {};
                for (const [ref, nodeRef] of client.getLastRefMap()) {
                    serialized[ref] = { nodeId: nodeRef.nodeId, backendDOMNodeId: nodeRef.backendDOMNodeId };
                }
                await this.sendToNative('kv_set', { key: 'cdp_refmap', value: serialized }).catch(() => { });
                return snap;
            }
            case 'click': {
                if (params.ref) {
                    await client.click(params.ref, {
                        right: params.right,
                        double: params.double,
                        count: params.count,
                        modifiers: params.modifiers,
                    });
                    return { ok: true };
                }
                // Coordinate clicks use screen coords — native CGEvent handles these correctly
                return this.sendToNative(method, params);
            }
            case 'hover': {
                if (params.ref) {
                    await client.hover(params.ref);
                    return { ok: true };
                }
                // Coordinate hovers use screen coords — route to native
                return this.sendToNative(method, params);
            }
            case 'focus': {
                await client.focus(params.ref);
                return { ok: true };
            }
            case 'type': {
                await client.type(params.text, { delay: params.delay });
                return { ok: true };
            }
            case 'fill': {
                await client.fill(params.ref, params.text);
                return { ok: true };
            }
            case 'key': {
                await client.key(params.combo, params.repeat);
                return { ok: true };
            }
            case 'scroll': {
                await client.scroll(params.direction, {
                    amount: params.amount,
                    on: params.on,
                });
                return { ok: true };
            }
            case 'select': {
                await client.select(params.ref, params.value);
                return { ok: true };
            }
            case 'check': {
                await client.check(params.ref);
                return { ok: true };
            }
            case 'uncheck': {
                await client.uncheck(params.ref);
                return { ok: true };
            }
            case 'find': {
                return client.find(params.text, {
                    role: params.role,
                    first: params.first,
                });
            }
            case 'read': {
                return client.read(params.ref, params.attr);
            }
            case 'box': {
                return client.box(params.ref);
            }
            case 'is': {
                return client.is(params.state, params.ref);
            }
            case 'children': {
                return client.children(params.ref);
            }
            case 'changed': {
                const changed = await client.changed();
                return { ok: true, changed };
            }
            case 'diff': {
                const diff = await client.diff();
                return { ok: true, ...diff };
            }
            default:
                // Fall through to native for unhandled CDP methods
                return this.sendToNative(method, params);
        }
    }
    async handleLaunch(params) {
        const name = params.name;
        if (!name)
            return this.sendToNative('launch', params);
        // Check if app is Chromium-based
        let isChromium = false;
        try {
            const result = await this.sendToNative('is_chromium', { name });
            isChromium = result.is_chromium;
        }
        catch { /* method unavailable — old daemon */ }
        if (!isChromium) {
            return this.sendToNative('launch', params);
        }
        // Chromium app — tell daemon to launch with CDP
        const port = await (0, port_manager_js_1.findFreePort)();
        const result = await this.sendToNative('launch_cdp', { name, port });
        // Wait for CDP to be ready
        await (0, discovery_js_1.waitForCDP)(port, 15000);
        return result;
    }
    async handleRelaunch(params) {
        const name = params.name;
        if (!name)
            throw new Error('Missing app name for relaunch');
        // Quit the app first
        try {
            await this.sendToNative('quit', { name, force: true });
        }
        catch { /* ok if not running */ }
        // Wait for it to exit
        await sleep(2000);
        // Relaunch with CDP
        return this.handleLaunch({ ...params, name });
    }
    async handleGrab(params) {
        // Send grab to native daemon first
        const result = await this.sendToNative('grab', params);
        // Window info is nested inside result.window
        const windowInfo = (result.window ?? result);
        const pid = windowInfo.process_id;
        const app = windowInfo.app;
        // Store grab info; CDP connection is established lazily by ensureCDPIfNeeded
        this.grabbedAppInfo = pid && app ? { pid, isCDP: false, app } : null;
        return result;
    }
    async handleUngrab(params) {
        this.grabbedAppInfo = null;
        return this.sendToNative('ungrab', params);
    }
    async handleBatch(params) {
        const commands = params.commands;
        const stopOnError = params.stop_on_error !== false;
        if (!commands || !Array.isArray(commands)) {
            return this.sendToNative('batch', params);
        }
        // Route each sub-command individually through the CDP/native decision
        const results = [];
        for (const cmd of commands) {
            const [method, ...rest] = cmd;
            const cmdParams = (rest[0] && typeof rest[0] === 'object') ? rest[0] : {};
            try {
                const result = await this.send(method, cmdParams);
                results.push({ ok: true, result });
            }
            catch (err) {
                results.push({ ok: false, error: err.message });
                if (stopOnError)
                    break;
            }
        }
        return { ok: true, results };
    }
    async handleWait(params) {
        // waitForText through CDP needs to poll snapshot
        if (params.text && this.grabbedAppInfo?.isCDP) {
            const text = params.text;
            const timeout = params.timeout ?? 10000;
            const gone = params.gone === true;
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const pid = this.grabbedAppInfo.pid;
                const client = this.cdpClients.get(pid);
                if (client?.isConnected()) {
                    try {
                        const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo.app });
                        const win = windowInfo.windows?.[0];
                        if (win) {
                            const snap = await client.snapshot({}, win);
                            const found = this.flattenElements(snap.elements).some(el => el.label?.includes(text) || el.value?.includes(text));
                            if (gone ? !found : found)
                                return { ok: true };
                        }
                    }
                    catch { /* retry */ }
                }
                await sleep(500);
            }
            throw new errors_js_1.TimeoutError(`Text "${text}" ${gone ? 'did not disappear' : 'not found'} within ${timeout}ms`);
        }
        // waitForApp and waitForWindow stay native
        return this.sendToNative('wait', params);
    }
    flattenElements(elements) {
        const result = [];
        const walk = (els) => {
            for (const el of els) {
                result.push(el);
                if (el.children)
                    walk(el.children);
            }
        };
        walk(elements);
        return result;
    }
    async ensureDaemon() {
        // Check if a daemon is already running
        const info = this.readDaemonInfo();
        if (info && this.isProcessAlive(info.pid)) {
            try {
                await this.connectToSocket(info.socket);
                return;
            }
            catch {
                // Socket exists but connection failed — daemon is dead
            }
        }
        // Clean up stale state
        this.cleanupStaleFiles();
        // Spawn new daemon
        await this.spawnDaemon();
        await this.waitForSocket();
        // Poll for daemon.json to appear (the daemon may flush it slightly after the socket/pipe is ready)
        const djStart = Date.now();
        while (Date.now() - djStart < 2000) {
            if ((0, fs_1.existsSync)(index_js_1.DAEMON_JSON_PATH))
                break;
            await sleep(50);
        }
        const newInfo = this.readDaemonInfo();
        if (!newInfo) {
            throw new Error('Daemon started but daemon.json not found');
        }
        await this.connectToSocket(newInfo.socket);
    }
    async spawnDaemon() {
        (0, fs_1.mkdirSync)(index_js_1.AC_DIR, { recursive: true });
        this.daemonProcess = (0, child_process_1.spawn)(this.binaryPath, ['--daemon'], {
            detached: true,
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        this.daemonProcess.unref();
        // Log daemon stderr for debugging
        this.daemonProcess.stderr?.on('data', (data) => {
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
    async waitForSocket(maxWait = 5000) {
        const start = Date.now();
        if (index_js_1.IS_NAMED_PIPE) {
            // Named pipes don't exist as files — probe by attempting connection
            while (Date.now() - start < maxWait) {
                try {
                    await this.probeConnection(index_js_1.SOCKET_PATH);
                    return;
                }
                catch { /* not ready yet */ }
                await sleep(100);
            }
            throw new Error(`Daemon pipe did not become available within ${maxWait}ms`);
        }
        // Unix socket: wait for file to appear on disk
        while (Date.now() - start < maxWait) {
            if ((0, fs_1.existsSync)(index_js_1.SOCKET_PATH)) {
                await sleep(50);
                return;
            }
            await sleep(50);
        }
        throw new Error(`Daemon socket did not appear within ${maxWait}ms`);
    }
    probeConnection(path) {
        return new Promise((resolve, reject) => {
            const sock = (0, net_1.connect)({ path });
            const timeout = setTimeout(() => { sock.destroy(); reject(new Error('probe timeout')); }, 500);
            sock.on('connect', () => { clearTimeout(timeout); sock.destroy(); resolve(); });
            sock.on('error', (err) => { clearTimeout(timeout); reject(err); });
        });
    }
    connectToSocket(socketPath) {
        return new Promise((resolve, reject) => {
            const sock = (0, net_1.connect)({ path: socketPath });
            const timeout = setTimeout(() => {
                sock.destroy();
                reject(new Error('Socket connection timed out'));
            }, 3000);
            sock.on('connect', () => {
                clearTimeout(timeout);
                this.socket = sock;
                this.buffer = '';
                this.bomChecked = false;
                this.setupSocketHandlers();
                resolve();
            });
            sock.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }
    setupSocketHandlers() {
        if (!this.socket)
            return;
        this.socket.on('data', (chunk) => {
            let str = chunk.toString();
            // Strip UTF-8 BOM if present (Windows .NET may emit one on first chunk)
            if (!this.bomChecked) {
                if (str.charCodeAt(0) === 0xFEFF)
                    str = str.slice(1);
                this.bomChecked = true;
            }
            this.buffer += str;
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
    processBuffer() {
        let newlineIdx;
        while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, newlineIdx);
            this.buffer = this.buffer.slice(newlineIdx + 1);
            if (!line.trim())
                continue;
            try {
                const raw = JSON.parse(line);
                const pending = this.pendingRequests.get(raw.id);
                if (pending) {
                    this.pendingRequests.delete(raw.id);
                    clearTimeout(pending.timer);
                    try {
                        const result = parseResponse(raw);
                        pending.resolve(result);
                    }
                    catch (err) {
                        pending.reject(err);
                    }
                }
            }
            catch {
                // Malformed response — ignore
            }
        }
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
    cleanupStaleFiles() {
        // Named pipes are kernel objects — no file to unlink
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
    isRunning() {
        return this.socket !== null && !this.socket.destroyed;
    }
    daemonPid() {
        const info = this.readDaemonInfo();
        return info?.pid ?? null;
    }
    async disconnect() {
        // Disconnect all CDP clients
        for (const [pid, client] of this.cdpClients) {
            try {
                await client.disconnect();
            }
            catch { /* ok */ }
        }
        this.cdpClients.clear();
        this.grabbedAppInfo = null;
        if (this.socket && !this.socket.destroyed) {
            this.socket.destroy();
            this.socket = null;
        }
    }
    async shutdown() {
        // Disconnect all CDP clients first
        for (const [pid, client] of this.cdpClients) {
            try {
                await client.disconnect();
            }
            catch { /* ok */ }
        }
        this.cdpClients.clear();
        this.grabbedAppInfo = null;
        if (this.socket && !this.socket.destroyed) {
            try {
                await this.sendToNative('shutdown', {});
            }
            catch { /* ok — socket may close before response */ }
            await sleep(100);
        }
        this.socket?.destroy();
        this.socket = null;
    }
    // Kill the daemon process directly (for testing crash recovery)
    _killDaemonProcess() {
        const info = this.readDaemonInfo();
        if (info) {
            try {
                process.kill(info.pid, 'SIGKILL');
            }
            catch { /* ok */ }
        }
        this.socket?.destroy();
        this.socket = null;
    }
    // Send raw data directly to socket (for testing malformed input handling)
    _sendRawToSocket(data) {
        this.socket?.write(data);
    }
}
exports.Bridge = Bridge;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
