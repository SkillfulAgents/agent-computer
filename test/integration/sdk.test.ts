import { describe, test, expect, afterAll } from 'vitest';
import { AC } from '../../src/sdk.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SDK — AC class integration', () => {
  const ac = new AC({ timeout: 20000 });

  afterAll(async () => {
    await ac.disconnect();
    await sleep(500);
  });

  test('ac.status returns daemon info', async () => {
    const status = await ac.status();
    expect(status).toBeDefined();
    expect(status.daemon_pid).toBeDefined();
  });

  test('ac.permissions returns permission status', async () => {
    const perms = await ac.permissions();
    expect(perms.accessibility).toBe(true);
    expect(typeof perms.screen_recording).toBe('boolean');
  });

  test('ac.apps returns running apps', async () => {
    const result = await ac.apps();
    expect(result.apps).toBeDefined();
    expect(Array.isArray(result.apps)).toBe(true);
    expect(result.apps.length).toBeGreaterThan(0);
  });

  test('ac.windows returns window list', async () => {
    const result = await ac.windows();
    expect(result.windows).toBeDefined();
    expect(Array.isArray(result.windows)).toBe(true);
  });

  test('ac.displays returns display info', async () => {
    const result = await ac.displays();
    expect(result.displays).toBeDefined();
    expect(result.displays.length).toBeGreaterThan(0);
    expect(result.displays[0].width).toBeGreaterThan(0);
  });

  test('ac.clipboardSet and ac.clipboardRead roundtrip', async () => {
    await ac.clipboardSet('sdk-test-value');
    const result = await ac.clipboardRead();
    expect(result.text).toBe('sdk-test-value');
  });

  test('ac.batch executes commands', async () => {
    const result = await ac.batch([
      ['ping'],
      ['version'],
    ]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
  });

  test('ac.menuList returns menus for TextEdit', async () => {
    try {
      await ac.launch('TextEdit', { wait: true });
      await sleep(1000);
      const result = await ac.menuList(undefined, { app: 'TextEdit' });
      expect(result.items).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
    } finally {
      try { await ac.quit('TextEdit', { force: true }); } catch { /* ok */ }
    }
  });
});

describe('SDK — Human-Like Methods', () => {
  const ac = new AC({ timeout: 20000 });

  afterAll(async () => {
    await ac.disconnect();
    await sleep(500);
  });

  test('human_move sends curved mouse to coordinates', async () => {
    // Access bridge directly for human_* methods
    const bridge = (ac as any).bridge;
    const result = await bridge.send('human_move', { x: 500, y: 500, duration: 0.2 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('human_type types text with variable cadence', async () => {
    const bridge = (ac as any).bridge;
    const result = await bridge.send('human_type', { text: 'Hi', delay: 30 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.length).toBe(2);
    expect(result.human).toBe(true);
  });
});
