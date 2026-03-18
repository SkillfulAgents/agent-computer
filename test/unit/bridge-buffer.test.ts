import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { DaemonManager } from '../../src/daemon.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// These tests verify the bridge correctly handles various socket data patterns
// by sending real requests through the daemon and verifying responses
describe('Bridge Buffer and Communication', () => {
  let bridge: Bridge;
  let manager: DaemonManager;

  beforeEach(async () => {
    manager = new DaemonManager();
    await manager.stop();
    await sleep(200);
    await manager.start();
    await sleep(100);
  });

  afterEach(async () => {
    try { await bridge?.disconnect(); } catch { /* ok */ }
    try { await manager?.stop(); } catch { /* ok */ }
    await sleep(200);
  });

  test('sequential requests get correct responses', async () => {
    bridge = new Bridge();
    const r1 = await bridge.send('ping') as Record<string, unknown>;
    const r2 = await bridge.send('status') as Record<string, unknown>;
    const r3 = await bridge.send('version') as Record<string, unknown>;

    expect(r1).toMatchObject({ pong: true });
    expect(r2).toHaveProperty('daemon_pid');
    expect(r3).toHaveProperty('version');
  });

  test('rapid sequential requests all return correctly', async () => {
    bridge = new Bridge();

    const results: unknown[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(await bridge.send('ping'));
    }

    expect(results).toHaveLength(20);
    for (const r of results) {
      expect(r).toMatchObject({ pong: true });
    }
  });

  test('concurrent requests all return correctly (ID matching)', async () => {
    bridge = new Bridge();

    // Send 10 concurrent requests — bridge must match responses by ID
    const promises = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0
        ? bridge.send('ping')
        : bridge.send('version'),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);

    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        expect(results[i]).toMatchObject({ pong: true });
      } else {
        expect(results[i]).toMatchObject({ version: expect.any(String) });
      }
    }
  });

  test('malformed data followed by valid request still works', async () => {
    bridge = new Bridge();
    await bridge.send('ping'); // connect

    // Send garbage
    bridge._sendRawToSocket('garbage data\n');
    bridge._sendRawToSocket('{incomplete json\n');
    bridge._sendRawToSocket('\n\n\n');

    // Valid request should still work
    const result = await bridge.send('ping') as Record<string, unknown>;
    expect(result).toMatchObject({ pong: true });
  });

  test('sendOneShot handles error response from binary', () => {
    bridge = new Bridge();
    try {
      bridge.sendOneShot('nonexistent');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.name).toBe('METHOD_NOT_FOUND');
      expect(err.code).toBe(-32601);
    }
  });

  test('sendOneShot returns result for valid commands', () => {
    bridge = new Bridge();
    const result = bridge.sendOneShot('version') as Record<string, unknown>;
    expect(result).toHaveProperty('version', '0.1.0');
  });
});
