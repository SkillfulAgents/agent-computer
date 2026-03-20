import { connect, type Socket } from 'net';
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { errorFromCode, ACError, TimeoutError } from './errors.js';
import { SOCKET_PATH, DAEMON_JSON_PATH, AC_DIR } from './platform/darwin.js';
import { resolveBinary } from './platform/resolve.js';
import { CDPClient } from './cdp/client.js';
import { findFreePort } from './cdp/port-manager.js';
import { waitForCDP } from './cdp/discovery.js';

let nextId = 1;

// Methods that can be routed to CDP when a Chromium app is grabbed
const CDP_CAPABLE_METHODS = new Set([
  'snapshot', 'find', 'read', 'children', 'click', 'hover', 'focus',
  'type', 'fill', 'key', 'scroll', 'select', 'check', 'uncheck',
  'box', 'is', 'changed', 'diff',
]);

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

  // CDP routing state
  private cdpClients = new Map<number, CDPClient>(); // pid → CDPClient
  private grabbedAppInfo: { pid: number; isCDP: boolean; app: string } | null = null;

  constructor(options: BridgeOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.binaryPath = options.binaryPath ?? resolveBinary();
  }

  // Send a JSON-RPC request — routes to CDP or native daemon
  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    // Special handlers
    if (method === 'launch') return this.handleLaunch(params);
    if (method === 'relaunch') return this.handleRelaunch(params);
    if (method === 'grab') return this.handleGrab(params);
    if (method === 'ungrab') return this.handleUngrab(params);
    if (method === 'batch') return this.handleBatch(params);
    if (method === 'wait') return this.handleWait(params);

    // Route to CDP if applicable
    if (CDP_CAPABLE_METHODS.has(method) && await this.ensureCDPIfNeeded()) {
      return this.sendToCDP(method, params);
    }

    return this.sendToNative(method, params);
  }

  // Send directly to the native daemon
  async sendToNative(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
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

  /**
   * Lazily detect if the currently grabbed app has CDP available.
   * Checks live every time: asks daemon for grab state, checks if Chromium,
   * scans port range for a live CDP endpoint.
   */
  private async ensureCDPIfNeeded(): Promise<boolean> {
    // Already connected this session
    if (this.grabbedAppInfo?.isCDP) return true;

    // Ask the daemon what's grabbed (status includes app name and pid from cached window info)
    let status: Record<string, unknown>;
    try {
      status = await this.sendToNative('status') as Record<string, unknown>;
    } catch { return false; }

    const app = status.grabbed_app as string | null;
    const pid = status.grabbed_pid as number | null;
    if (!app || !pid) return false;

    // Ask daemon for CDP port
    let port: number | undefined;
    try {
      const result = await this.sendToNative('cdp_port', { name: app }) as { port: number | null };
      if (result.port) port = result.port;
    } catch { return false; }

    if (!port) return false;

    // Connect CDP client
    try {
      await waitForCDP(port, 3000);
      const client = new CDPClient(port);
      await client.connect();
      this.cdpClients.set(pid, client);
      this.grabbedAppInfo = { pid, isCDP: true, app };
      return true;
    } catch {
      return false;
    }
  }

  private async sendToCDP(method: string, params: Record<string, unknown>): Promise<unknown> {
    const pid = this.grabbedAppInfo!.pid;
    const client = this.cdpClients.get(pid);
    if (!client || !client.isConnected()) {
      throw new Error('CDP client not connected for grabbed app');
    }

    // For non-snapshot commands, ensure we have state from a previous snapshot
    if (method !== 'snapshot' && client.getLastRefMap().size === 0) {
      // First try loading the persisted refMap (fast, for click/hover/focus)
      try {
        const kv = await this.sendToNative('kv_get', { key: 'cdp_refmap' }) as { value: Record<string, { nodeId: string; backendDOMNodeId: number }> | null };
        if (kv.value && typeof kv.value === 'object') {
          const map = client.getLastRefMap();
          for (const [ref, nodeRef] of Object.entries(kv.value)) {
            map.set(ref, nodeRef);
          }
        }
      } catch { /* old daemon without kv_set */ }

      // For query commands that need full elements, take a fresh snapshot
      const NEEDS_ELEMENTS = new Set(['find', 'read', 'is', 'children', 'changed', 'diff']);
      if (NEEDS_ELEMENTS.has(method)) {
        const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo!.app }) as any;
        const win = windowInfo.windows?.[0];
        if (win) await client.snapshot({}, win);
      }
    }

    switch (method) {
      case 'snapshot': {
        // Get window info from native daemon
        const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo!.app }) as any;
        const win = windowInfo.windows?.[0];
        if (!win) throw new Error('No window found for grabbed CDP app');
        const snap = await client.snapshot({
          interactive: params.interactive as boolean | undefined,
          depth: params.depth as number | undefined,
        }, win);

        // Persist refMap to daemon so other CLI invocations can use it
        const serialized: Record<string, { nodeId: string; backendDOMNodeId: number }> = {};
        for (const [ref, nodeRef] of client.getLastRefMap()) {
          serialized[ref] = { nodeId: nodeRef.nodeId, backendDOMNodeId: nodeRef.backendDOMNodeId };
        }
        await this.sendToNative('kv_set', { key: 'cdp_refmap', value: serialized }).catch(() => {});

        return snap;
      }
      case 'click': {
        if (params.ref) {
          await client.click(params.ref as string, {
            right: params.right as boolean | undefined,
            double: params.double as boolean | undefined,
            count: params.count as number | undefined,
            modifiers: params.modifiers as string[] | undefined,
          });
          return { ok: true };
        }
        // Coordinate clicks use screen coords — native CGEvent handles these correctly
        return this.sendToNative(method, params);
      }
      case 'hover': {
        if (params.ref) {
          await client.hover(params.ref as string);
          return { ok: true };
        }
        // Coordinate hovers use screen coords — route to native
        return this.sendToNative(method, params);
      }
      case 'focus': {
        await client.focus(params.ref as string);
        return { ok: true };
      }
      case 'type': {
        await client.type(params.text as string, { delay: params.delay as number | undefined });
        return { ok: true };
      }
      case 'fill': {
        await client.fill(params.ref as string, params.text as string);
        return { ok: true };
      }
      case 'key': {
        await client.key(params.combo as string, params.repeat as number | undefined);
        return { ok: true };
      }
      case 'scroll': {
        await client.scroll(params.direction as 'up' | 'down' | 'left' | 'right', {
          amount: params.amount as number | undefined,
          on: params.on as string | undefined,
        });
        return { ok: true };
      }
      case 'select': {
        await client.select(params.ref as string, params.value as string);
        return { ok: true };
      }
      case 'check': {
        await client.check(params.ref as string);
        return { ok: true };
      }
      case 'uncheck': {
        await client.uncheck(params.ref as string);
        return { ok: true };
      }
      case 'find': {
        return client.find(params.text as string, {
          role: params.role as string | undefined,
          first: params.first as boolean | undefined,
        });
      }
      case 'read': {
        return client.read(params.ref as string, params.attr as string | undefined);
      }
      case 'box': {
        return client.box(params.ref as string);
      }
      case 'is': {
        return client.is(params.state as string, params.ref as string);
      }
      case 'children': {
        return client.children(params.ref as string);
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

  private async handleLaunch(params: Record<string, unknown>): Promise<unknown> {
    const name = params.name as string;
    if (!name) return this.sendToNative('launch', params);

    // Check if app is Chromium-based
    let isChromium = false;
    try {
      const result = await this.sendToNative('is_chromium', { name }) as { is_chromium: boolean };
      isChromium = result.is_chromium;
    } catch { /* method unavailable — old daemon */ }

    if (!isChromium) {
      return this.sendToNative('launch', params);
    }

    // Chromium app — tell daemon to launch with CDP
    const port = await findFreePort();
    const result = await this.sendToNative('launch_cdp', { name, port });

    // Wait for CDP to be ready
    await waitForCDP(port, 15000);

    return result;
  }

  private async handleRelaunch(params: Record<string, unknown>): Promise<unknown> {
    const name = params.name as string;
    if (!name) throw new Error('Missing app name for relaunch');

    // Quit the app first
    try {
      await this.sendToNative('quit', { name, force: true });
    } catch { /* ok if not running */ }

    // Wait for it to exit
    await sleep(2000);

    // Relaunch with CDP
    return this.handleLaunch({ ...params, name });
  }

  private async handleGrab(params: Record<string, unknown>): Promise<unknown> {
    // Send grab to native daemon first
    const result = await this.sendToNative('grab', params) as Record<string, unknown>;

    // Window info is nested inside result.window
    const windowInfo = (result.window ?? result) as Record<string, unknown>;
    const pid = windowInfo.process_id as number | undefined;
    const app = windowInfo.app as string | undefined;

    // Store grab info; CDP connection is established lazily by ensureCDPIfNeeded
    this.grabbedAppInfo = pid && app ? { pid, isCDP: false, app } : null;
    return result;
  }

  private async handleUngrab(params: Record<string, unknown>): Promise<unknown> {
    this.grabbedAppInfo = null;
    return this.sendToNative('ungrab', params);
  }

  private async handleBatch(params: Record<string, unknown>): Promise<unknown> {
    const commands = params.commands as Array<[string, ...unknown[]]> | undefined;
    const stopOnError = params.stop_on_error !== false;
    if (!commands || !Array.isArray(commands)) {
      return this.sendToNative('batch', params);
    }

    // Route each sub-command individually through the CDP/native decision
    const results: Array<{ ok: boolean; result?: unknown; error?: string }> = [];
    for (const cmd of commands) {
      const [method, ...rest] = cmd;
      const cmdParams = (rest[0] && typeof rest[0] === 'object') ? rest[0] as Record<string, unknown> : {};
      try {
        const result = await this.send(method, cmdParams);
        results.push({ ok: true, result });
      } catch (err: any) {
        results.push({ ok: false, error: err.message });
        if (stopOnError) break;
      }
    }
    return { ok: true, results };
  }

  private async handleWait(params: Record<string, unknown>): Promise<unknown> {
    // waitForText through CDP needs to poll snapshot
    if (params.text && this.grabbedAppInfo?.isCDP) {
      const text = params.text as string;
      const timeout = (params.timeout as number) ?? 10000;
      const gone = params.gone === true;
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const pid = this.grabbedAppInfo.pid;
        const client = this.cdpClients.get(pid);
        if (client?.isConnected()) {
          try {
            const windowInfo = await this.sendToNative('windows', { app: this.grabbedAppInfo.app }) as any;
            const win = windowInfo.windows?.[0];
            if (win) {
              const snap = await client.snapshot({}, win);
              const found = this.flattenElements(snap.elements).some(
                el => el.label?.includes(text) || el.value?.includes(text)
              );
              if (gone ? !found : found) return { ok: true };
            }
          } catch { /* retry */ }
        }
        await sleep(500);
      }
      throw new TimeoutError(`Text "${text}" ${gone ? 'did not disappear' : 'not found'} within ${timeout}ms`);
    }

    // waitForApp and waitForWindow stay native
    return this.sendToNative('wait', params);
  }

  private flattenElements(elements: Array<{ label?: string | null; value?: string | null; children?: any[] }>): typeof elements {
    const result: typeof elements = [];
    const walk = (els: typeof elements) => {
      for (const el of els) {
        result.push(el);
        if (el.children) walk(el.children);
      }
    };
    walk(elements);
    return result;
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
    // Disconnect all CDP clients
    for (const [pid, client] of this.cdpClients) {
      try { await client.disconnect(); } catch { /* ok */ }
    }
    this.cdpClients.clear();
    this.grabbedAppInfo = null;

    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async shutdown(): Promise<void> {
    // Disconnect all CDP clients first
    for (const [pid, client] of this.cdpClients) {
      try { await client.disconnect(); } catch { /* ok */ }
    }
    this.cdpClients.clear();
    this.grabbedAppInfo = null;

    if (this.socket && !this.socket.destroyed) {
      try {
        await this.sendToNative('shutdown', {});
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
