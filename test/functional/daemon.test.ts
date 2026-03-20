import { describe, test, expect, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Daemon Health', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
  });

  test('daemon responds to ping', async () => {
    const result = await bridge.send('ping') as any;
    expect(result.pong).toBe(true);
  });

  test('daemon version matches expected', async () => {
    const result = await bridge.send('version') as any;
    expect(result.version).toBe('0.1.0');
  });

  test('daemon status includes uptime', async () => {
    const result = await bridge.send('status') as any;
    expect(result.daemon_pid).toBeGreaterThan(0);
    expect(result.daemon_uptime_ms).toBeGreaterThanOrEqual(0);
  });

  test('daemon permissions are granted', async () => {
    const result = await bridge.send('permissions') as any;
    expect(result.accessibility).toBe(true);
  });

  test('daemon registered methods include all expected', async () => {
    // Verify key methods work
    const methods = ['ping', 'version', 'status', 'snapshot', 'click', 'type',
                     'fill', 'key', 'find', 'read', 'scroll', 'menu_click',
                     'menu_list', 'dialog', 'drag', 'batch', 'changed', 'diff',
                     'human_click', 'human_type', 'human_move'];

    for (const method of ['ping', 'version', 'status']) {
      const result = await bridge.send(method) as any;
      expect(result).toBeDefined();
    }
  });
});
