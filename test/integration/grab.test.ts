import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Grab/Ungrab Session', () => {
  const bridge = new Bridge({ timeout: 15000 });

  beforeAll(async () => {
    // Launch TextEdit for testing
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(500);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('ungrab'); } catch { /* ok */ }
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('windows lists open windows', async () => {
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;
    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBeGreaterThan(0);

    // Each window has expected fields
    const win = windows[0];
    expect(win).toHaveProperty('ref');
    expect(win).toHaveProperty('title');
    expect(win).toHaveProperty('app');
    expect(win).toHaveProperty('bounds');
    expect(win).toHaveProperty('minimized');
    expect(win).toHaveProperty('hidden');
    expect((win.ref as string).startsWith('@w')).toBe(true);
  });

  test('windows --app filters by app', async () => {
    const result = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(w.app).toBe('TextEdit');
    }
  });

  test('grab sets active window', async () => {
    // Get TextEdit window ref
    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as Array<Record<string, unknown>>;
    const ref = windows[0].ref as string;

    // Grab it
    const grabResult = await bridge.send('grab', { ref }) as Record<string, unknown>;
    expect(grabResult.ok).toBe(true);
    expect((grabResult.window as Record<string, unknown>).app).toBe('TextEdit');

    // Status should show grabbed window
    const statusResult = await bridge.send('status') as Record<string, unknown>;
    expect(statusResult.grabbed_window).toBe(ref);
  });

  test('grab by app name', async () => {
    const result = await bridge.send('grab', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect((result.window as Record<string, unknown>).app).toBe('TextEdit');
  });

  test('ungrab clears active window', async () => {
    // Grab first
    await bridge.send('grab', { app: 'TextEdit' });
    const statusBefore = await bridge.send('status') as Record<string, unknown>;
    expect(statusBefore.grabbed_window).not.toBeNull();

    // Ungrab
    await bridge.send('ungrab');
    const statusAfter = await bridge.send('status') as Record<string, unknown>;
    expect(statusAfter.grabbed_window).toBeNull();
  });

  test('grab invalid ref returns WINDOW_NOT_FOUND', async () => {
    try {
      await bridge.send('grab', { ref: '@w999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005);
      expect(err.name).toBe('WINDOW_NOT_FOUND');
    }
  });

  test('grab invalid app returns WINDOW_NOT_FOUND', async () => {
    try {
      await bridge.send('grab', { app: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005);
    }
  });
});
