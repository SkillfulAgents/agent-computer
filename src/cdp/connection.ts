import * as http from 'http';
import * as crypto from 'crypto';
import type { Socket } from 'net';

export class CDPConnection {
  private socket: Socket | null = null;
  private nextId = 1;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private eventHandlers = new Map<string, Set<(params: unknown) => void>>();
  private buffer = Buffer.alloc(0);
  private _url: string = '';
  private commandTimeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.commandTimeout = options.timeout ?? 10000;
  }

  get url(): string { return this._url; }
  get connected(): boolean { return this.socket !== null && !this.socket.destroyed; }

  async connect(wsUrl: string): Promise<void> {
    this._url = wsUrl;
    const url = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');

    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
        },
      });

      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('WebSocket connection timed out'));
      }, 5000);

      req.on('upgrade', (_res, socket, head) => {
        clearTimeout(timeout);
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        if (head.length > 0) {
          this.buffer = Buffer.concat([this.buffer, head]);
        }
        this.setupSocketHandlers();
        resolve();
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${err.message}`));
      });

      req.on('response', (res) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket upgrade failed with status ${res.statusCode}`));
      });
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('CDP connection not open');
    }

    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params: params ?? {} });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command "${method}" timed out after ${this.commandTimeout}ms`));
      }, this.commandTimeout);

      this.pending.set(id, { resolve, reject, timer });
      this.writeFrame(message);
    });
  }

  on(event: string, handler: (params: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (params: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  async close(): Promise<void> {
    if (!this.socket || this.socket.destroyed) return;

    // Send close frame
    const frame = Buffer.alloc(6);
    frame[0] = 0x88; // FIN + close opcode
    frame[1] = 0x80; // Mask bit set, 0 payload length
    crypto.randomBytes(4).copy(frame, 2); // Masking key
    this.socket.write(frame);

    // Reject pending
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection closed'));
      this.pending.delete(id);
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        this.socket = null;
        resolve();
      }, 1000);

      this.socket!.once('close', () => {
        clearTimeout(timer);
        this.socket = null;
        resolve();
      });

      this.socket!.end();
    });
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processFrames();
    });

    this.socket.on('close', () => {
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        p.reject(new Error('Connection closed'));
      }
      this.pending.clear();
      this.socket = null;
    });

    this.socket.on('error', () => {
      // Handled by close event
    });
  }

  private processFrames(): void {
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) return; // Need more data
        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) return;
        // For simplicity, read as 32-bit (CDP messages won't exceed 4GB)
        payloadLength = this.buffer.readUInt32BE(6);
        offset = 10;
      }

      if (masked) offset += 4; // Skip masking key (server shouldn't mask, but handle it)

      if (this.buffer.length < offset + payloadLength) return; // Need more data

      let payload = this.buffer.subarray(offset, offset + payloadLength);

      if (masked) {
        const maskKey = this.buffer.subarray(offset - 4, offset);
        payload = Buffer.from(payload); // Copy so we can mutate
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      this.buffer = this.buffer.subarray(offset + payloadLength);

      if (opcode === 0x1) {
        // Text frame
        this.handleMessage(payload.toString('utf-8'));
      } else if (opcode === 0x8) {
        // Close frame
        this.socket?.end();
      } else if (opcode === 0x9) {
        // Ping — respond with pong
        this.writePong(payload);
      }
      // Ignore other opcodes (pong, binary, continuation)
    }
  }

  private handleMessage(text: string): void {
    try {
      const msg = JSON.parse(text) as { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string } };

      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);

        if (msg.error) {
          p.reject(new Error(`CDP error: ${msg.error.message}`));
        } else {
          p.resolve(msg.result);
        }
      } else if (msg.method) {
        // Event
        const handlers = this.eventHandlers.get(msg.method);
        if (handlers) {
          for (const handler of handlers) {
            handler(msg.params);
          }
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private writeFrame(text: string): void {
    if (!this.socket || this.socket.destroyed) return;

    const payload = Buffer.from(text, 'utf-8');
    const maskKey = crypto.randomBytes(4);

    let header: Buffer;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text opcode
      header[1] = 0x80 | payload.length; // Masked
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }

    // Mask the payload
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
      masked[i] = payload[i] ^ maskKey[i % 4];
    }

    this.socket.write(Buffer.concat([header, maskKey, masked]));
  }

  private writePong(payload: Buffer): void {
    if (!this.socket || this.socket.destroyed) return;

    const maskKey = crypto.randomBytes(4);
    const header = Buffer.alloc(2);
    header[0] = 0x8a; // FIN + pong opcode
    header[1] = 0x80 | payload.length;

    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
      masked[i] = payload[i] ^ maskKey[i % 4];
    }

    this.socket.write(Buffer.concat([header, maskKey, masked]));
  }
}
