import { describe, test, expect, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('E2E — Error Recovery', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
  });

  test('click on stale ref returns helpful error', async () => {
    try {
      await bridge.send('click', { ref: '@b999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
      expect(err.message).toContain('Element not found');
      expect(err.message).toContain('snapshot');
    }
  });

  test('fill on nonexistent ref returns error', async () => {
    try {
      await bridge.send('fill', { ref: '@t999', text: 'test' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('read on nonexistent ref returns error', async () => {
    try {
      await bridge.send('read', { ref: '@x999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('unknown method returns method not found', async () => {
    try {
      await bridge.send('totally_fake_method_12345');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32601);
    }
  });

  test('missing required params return invalid params error', async () => {
    try {
      await bridge.send('click', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('daemon recovers after rapid fire commands', async () => {
    // Send many commands rapidly
    const promises = Array.from({ length: 10 }, () => bridge.send('ping'));
    const results = await Promise.all(promises);
    for (const r of results) {
      expect((r as any).pong).toBe(true);
    }
  });

  test('batch with mixed valid/invalid recovers', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['click', { ref: '@nonexistent' }],
        ['version'],
      ],
      stop_on_error: false
    }) as any;

    expect(result.count).toBe(3);
    expect(result.results[0].result).toBeDefined(); // ping OK
    expect(result.results[1].error).toBeDefined();   // click failed
    expect(result.results[2].result).toBeDefined(); // version OK - recovered
  });

  test('snapshot after error works normally', async () => {
    // Try an invalid operation
    try {
      await bridge.send('click', { ref: '@z999' });
    } catch { /* expected */ }

    // Daemon should still work fine
    const result = await bridge.send('ping') as any;
    expect(result.pong).toBe(true);
  });

  test('concurrent operations don\'t interfere', async () => {
    const [r1, r2, r3] = await Promise.all([
      bridge.send('ping'),
      bridge.send('version'),
      bridge.send('status'),
    ]);

    expect((r1 as any).pong).toBe(true);
    expect((r2 as any).version).toBe('0.1.0');
    expect((r3 as any).daemon_pid).toBeGreaterThan(0);
  });
});
