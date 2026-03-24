import { describe, test, expect, afterEach } from 'vitest';
import { Bridge } from '../../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Windows — Enumeration and Management', () => {
  let bridge: Bridge;

  afterEach(async () => {
    try { await bridge.send('ungrab'); } catch { /* ok */ }
    try { await bridge.shutdown(); } catch { /* ok */ }
    await sleep(300);
  });

  test('windows returns at least one window', async () => {
    bridge = new Bridge({ timeout: 15000 });
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;
    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBeGreaterThan(0);
  });

  test('windows have required fields', async () => {
    bridge = new Bridge({ timeout: 15000 });
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;
    expect(windows.length).toBeGreaterThan(0);

    const win = windows[0];
    expect(win).toHaveProperty('ref');
    expect(win).toHaveProperty('title');
    expect(win).toHaveProperty('app');
    expect(win).toHaveProperty('process_id');
    expect(win).toHaveProperty('bounds');

    expect(typeof win.ref).toBe('string');
    expect(typeof win.title).toBe('string');
    expect(typeof win.app).toBe('string');
    expect(typeof win.process_id).toBe('number');
    expect(Array.isArray(win.bounds)).toBe(true);
    expect((win.bounds as number[]).length).toBe(4);
  });

  test('window refs start with @w', async () => {
    bridge = new Bridge({ timeout: 15000 });
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;

    for (const win of windows) {
      expect((win.ref as string).startsWith('@w')).toBe(true);
      expect(win.ref).toMatch(/^@w\d+$/);
    }
  });

  test('window bounds have valid dimensions', async () => {
    bridge = new Bridge({ timeout: 15000 });
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;

    // Find a window with non-zero bounds (skip minimized windows)
    const visible = windows.find(w => {
      const bounds = w.bounds as number[];
      return bounds[2] > 0 && bounds[3] > 0;
    });

    expect(visible).toBeDefined();
    const bounds = visible!.bounds as number[];
    // On Windows, x/y can be negative (multi-monitor, off-screen, or window shadows)
    expect(typeof bounds[0]).toBe('number'); // x
    expect(typeof bounds[1]).toBe('number'); // y
    expect(bounds[2]).toBeGreaterThan(0);    // width > 0
    expect(bounds[3]).toBeGreaterThan(0);    // height > 0
  });

  test('window process_id is positive', async () => {
    bridge = new Bridge({ timeout: 15000 });
    const result = await bridge.send('windows') as Record<string, unknown>;
    const windows = result.windows as Array<Record<string, unknown>>;

    for (const win of windows) {
      expect(win.process_id as number).toBeGreaterThan(0);
    }
  });

  test('grab by app name works (notepad)', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    try {
      // Grab by app name
      const result = await bridge.send('grab', { app: 'notepad' }) as Record<string, unknown>;
      expect(result.ok).toBe(true);

      const window = result.window as Record<string, unknown>;
      expect(window).toBeDefined();
      // App name matching is case-insensitive on Windows; just check it exists
      expect(window.app).toBeDefined();
      expect(typeof window.app).toBe('string');
      expect((window.app as string).toLowerCase()).toContain('notepad');
      expect(window.ref).toBeDefined();
      expect((window.ref as string).startsWith('@w')).toBe(true);
    } finally {
      try { await bridge.send('ungrab'); } catch { /* ok */ }
      try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
      await sleep(500);
    }
  });

  test('status shows grabbed window after grab', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    try {
      // Grab notepad
      const grabResult = await bridge.send('grab', { app: 'notepad' }) as Record<string, unknown>;
      expect(grabResult.ok).toBe(true);

      const window = grabResult.window as Record<string, unknown>;
      const grabbedRef = window.ref as string;

      // Check status
      const status = await bridge.send('status') as Record<string, unknown>;
      expect(status.grabbed_window).toBe(grabbedRef);
      expect(status.grabbed_app).toBeDefined();
      expect(status.grabbed_pid).toBeDefined();
      expect(typeof status.grabbed_pid).toBe('number');
      expect(status.grabbed_pid as number).toBeGreaterThan(0);
    } finally {
      try { await bridge.send('ungrab'); } catch { /* ok */ }
      try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
      await sleep(500);
    }
  });

  test('ungrab clears grabbed state', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    try {
      // Grab
      await bridge.send('grab', { app: 'notepad' });

      // Verify grabbed
      const statusBefore = await bridge.send('status') as Record<string, unknown>;
      expect(statusBefore.grabbed_window).not.toBeNull();

      // Ungrab
      await bridge.send('ungrab');

      // Verify ungrabbed — Windows daemon may omit fields or set them to null
      const statusAfter = await bridge.send('status') as Record<string, unknown>;
      expect(statusAfter.grabbed_window ?? null).toBeNull();
      expect(statusAfter.grabbed_app ?? null).toBeNull();
      expect(statusAfter.grabbed_pid ?? null).toBeNull();
    } finally {
      try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
      await sleep(500);
    }
  });

  test('grab invalid ref returns WINDOW_NOT_FOUND', async () => {
    bridge = new Bridge({ timeout: 15000 });

    // Ensure daemon is running
    await bridge.send('ping');

    try {
      await bridge.send('grab', { ref: '@w999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005);
    }
  });

  test('grab nonexistent app returns error', async () => {
    bridge = new Bridge({ timeout: 15000 });

    // Ensure daemon is running
    await bridge.send('ping');

    try {
      await bridge.send('grab', { app: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005);
    }
  });

  test('windows filtered by app name', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    try {
      const result = await bridge.send('windows', { app: 'notepad' }) as Record<string, unknown>;
      const windows = result.windows as Array<Record<string, unknown>>;
      expect(windows.length).toBeGreaterThan(0);

      for (const w of windows) {
        expect((w.app as string).toLowerCase()).toContain('notepad');
      }
    } finally {
      try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
      await sleep(500);
    }
  });

  test('grab by window ref works', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    try {
      // List windows
      const winResult = await bridge.send('windows', { app: 'notepad' }) as Record<string, unknown>;
      const windows = winResult.windows as Array<Record<string, unknown>>;
      expect(windows.length).toBeGreaterThan(0);

      const ref = windows[0].ref as string;

      // Grab by ref
      const grabResult = await bridge.send('grab', { ref }) as Record<string, unknown>;
      expect(grabResult.ok).toBe(true);

      const window = grabResult.window as Record<string, unknown>;
      expect(window.ref).toBe(ref);
    } finally {
      try { await bridge.send('ungrab'); } catch { /* ok */ }
      try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
      await sleep(500);
    }
  });
});
