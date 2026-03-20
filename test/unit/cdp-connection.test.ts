import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as crypto from 'crypto';
import type { Socket } from 'net';
import { CDPConnection } from '../../src/cdp/connection.js';

interface MockWSServer {
  server: http.Server;
  getClients: () => Socket[];
  port: () => number;
  destroyAll: () => void;
}

// Mini WebSocket server for testing
function createMockWSServer(handler?: 'echo' | 'silent' | 'error'): MockWSServer {
  const clients: Socket[] = [];
  const server = http.createServer();

  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC11CE56')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n'
    );

    clients.push(socket as Socket);

    if (handler === 'silent') {
      // Don't respond to messages
      return;
    }

    // Handle incoming frames
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      // Parse frames
      while (buffer.length >= 2) {
        const firstByte = buffer[0];
        const opcode = firstByte & 0x0f;
        const secondByte = buffer[1];
        const masked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        }
        if (masked) offset += 4;
        if (buffer.length < offset + payloadLen) return;

        let payload = buffer.subarray(offset, offset + payloadLen);
        if (masked) {
          const maskKey = buffer.subarray(offset - 4, offset);
          payload = Buffer.from(payload);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
          }
        }
        buffer = buffer.subarray(offset + payloadLen);

        // Close frame - respond and close
        if (opcode === 0x8) {
          // Send close frame back (unmasked, from server)
          const closeFrame = Buffer.alloc(2);
          closeFrame[0] = 0x88;
          closeFrame[1] = 0x00;
          try { (socket as Socket).write(closeFrame); } catch { /* ok */ }
          try { (socket as Socket).end(); } catch { /* ok */ }
          return;
        }

        // Text frame
        if (opcode === 0x1) {
          const text = payload.toString('utf-8');
          try {
            const msg = JSON.parse(text);
            if (msg.id !== undefined && msg.method) {
              if (handler === 'error') {
                sendTextFrame(socket as Socket, JSON.stringify({
                  id: msg.id,
                  error: { message: 'Something went wrong', code: -32000 },
                }));
              } else {
                // Default: echo
                sendTextFrame(socket as Socket, JSON.stringify({
                  id: msg.id,
                  result: { echo: msg.method, params: msg.params },
                }));
              }
            }
          } catch { /* ignore non-JSON frames */ }
        }
      }
    });
  });

  return {
    server,
    getClients: () => clients,
    port: () => (server.address() as any)?.port ?? 0,
    destroyAll: () => {
      for (const c of clients) {
        try { c.destroy(); } catch { /* ok */ }
      }
      clients.length = 0;
    },
  };
}

function sendTextFrame(socket: Socket, text: string): void {
  const payload = Buffer.from(text, 'utf-8');
  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = payload.length;
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

async function listenOnRandomPort(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return (server.address() as any).port;
}

async function closeServer(mock: MockWSServer): Promise<void> {
  mock.destroyAll();
  await new Promise<void>((resolve) => {
    mock.server.close(() => resolve());
  });
}

describe('CDPConnection', () => {
  let mock: MockWSServer;
  let conn: CDPConnection;

  beforeEach(async () => {
    mock = createMockWSServer('echo');
    await listenOnRandomPort(mock.server);
    conn = new CDPConnection({ timeout: 3000 });
  });

  afterEach(async () => {
    await conn.close();
    await closeServer(mock);
  });

  test('connect and send/receive roundtrip', async () => {
    await conn.connect(`ws://127.0.0.1:${mock.port()}/devtools/page/test`);
    expect(conn.connected).toBe(true);

    const result = await conn.send('Page.enable') as any;
    expect(result.echo).toBe('Page.enable');
  });

  test('concurrent commands', async () => {
    await conn.connect(`ws://127.0.0.1:${mock.port()}/devtools/page/test`);

    const [r1, r2, r3] = await Promise.all([
      conn.send('DOM.enable') as Promise<any>,
      conn.send('Page.enable') as Promise<any>,
      conn.send('Runtime.enable') as Promise<any>,
    ]);

    expect(r1.echo).toBe('DOM.enable');
    expect(r2.echo).toBe('Page.enable');
    expect(r3.echo).toBe('Runtime.enable');
  });

  test('send with params', async () => {
    await conn.connect(`ws://127.0.0.1:${mock.port()}/devtools/page/test`);

    const result = await conn.send('DOM.getBoxModel', { nodeId: 123 }) as any;
    expect(result.echo).toBe('DOM.getBoxModel');
    expect(result.params.nodeId).toBe(123);
  });

  test('throws when not connected', async () => {
    await expect(conn.send('Page.enable')).rejects.toThrow('not open');
  });

  test('close disconnects', async () => {
    await conn.connect(`ws://127.0.0.1:${mock.port()}/devtools/page/test`);
    expect(conn.connected).toBe(true);

    await conn.close();
    expect(conn.connected).toBe(false);
  });

  test('timeout on no response', async () => {
    const silentMock = createMockWSServer('silent');
    const port = await listenOnRandomPort(silentMock.server);

    const slowConn = new CDPConnection({ timeout: 500 });
    await slowConn.connect(`ws://127.0.0.1:${port}/devtools/page/test`);

    await expect(slowConn.send('Page.enable')).rejects.toThrow('timed out');

    await slowConn.close();
    await closeServer(silentMock);
  }, 10000);

  test('event handler receives events', async () => {
    await conn.connect(`ws://127.0.0.1:${mock.port()}/devtools/page/test`);

    const events: unknown[] = [];
    conn.on('Page.loadEventFired', (params) => {
      events.push(params);
    });

    // Send event from server
    const client = mock.getClients()[0];
    sendTextFrame(client, JSON.stringify({
      method: 'Page.loadEventFired',
      params: { timestamp: 12345 },
    }));

    await sleep(100);
    expect(events).toHaveLength(1);
    expect((events[0] as any).timestamp).toBe(12345);
  });

  test('error response rejects promise', async () => {
    const errMock = createMockWSServer('error');
    const errPort = await listenOnRandomPort(errMock.server);

    const errConn = new CDPConnection({ timeout: 3000 });
    await errConn.connect(`ws://127.0.0.1:${errPort}/devtools/page/test`);

    await expect(errConn.send('BadMethod')).rejects.toThrow('CDP error');

    await errConn.close();
    await closeServer(errMock);
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
