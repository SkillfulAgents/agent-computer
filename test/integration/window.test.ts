import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Window Management — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });
  let windowRef: string;

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    // Create a new document
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1000);

    // Get window ref
    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    expect(windows.length).toBeGreaterThan(0);
    windowRef = windows[0].ref;
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('move changes window position', async () => {
    const result = await bridge.send('move', { ref: windowRef, x: 100, y: 100 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(windowRef);
    expect(result.position).toEqual([100, 100]);
    await sleep(300);

    // Verify position changed
    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    const win = windows[0];
    const [x, y] = win.bounds;
    // Allow small tolerance for window manager adjustments
    expect(Math.abs(x - 100)).toBeLessThan(10);
    expect(Math.abs(y - 100)).toBeLessThan(10);
  });

  test('resize changes window dimensions', async () => {
    const result = await bridge.send('resize', { ref: windowRef, width: 600, height: 400 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(windowRef);
    expect(result.size).toEqual([600, 400]);
    await sleep(300);

    // Verify size changed
    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    const win = windows[0];
    const [, , w, h] = win.bounds;
    expect(Math.abs(w - 600)).toBeLessThan(20);
    expect(Math.abs(h - 400)).toBeLessThan(20);
  });

  test('bounds sets position and size', async () => {
    const result = await bridge.send('bounds', {
      ref: windowRef, x: 200, y: 150, width: 700, height: 500,
    }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.bounds).toEqual([200, 150, 700, 500]);
    await sleep(300);

    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    const win = windows[0];
    const [x, y, w, h] = win.bounds;
    expect(Math.abs(x - 200)).toBeLessThan(10);
    expect(Math.abs(y - 150)).toBeLessThan(10);
    expect(Math.abs(w - 700)).toBeLessThan(20);
    expect(Math.abs(h - 500)).toBeLessThan(20);
  });

  test('bounds with preset left-half works', async () => {
    const result = await bridge.send('bounds', {
      ref: windowRef, preset: 'left-half',
    }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.bounds).toBeDefined();
    const bounds = result.bounds as number[];
    expect(bounds.length).toBe(4);
    // x should be near 0, width should be about half screen
    expect(bounds[0]).toBeLessThan(50);
    await sleep(300);
  });

  test('bounds with preset fill works', async () => {
    const result = await bridge.send('bounds', {
      ref: windowRef, preset: 'fill',
    }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    await sleep(300);
  });

  test('bounds with invalid preset returns error', async () => {
    try {
      await bridge.send('bounds', { ref: windowRef, preset: 'nonexistent' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('raise brings window to front', async () => {
    const result = await bridge.send('raise', { ref: windowRef }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(windowRef);
  });

  test('minimize hides the window', async () => {
    // First raise to ensure it's visible
    await bridge.send('raise', { ref: windowRef });
    await sleep(300);

    const result = await bridge.send('minimize', { ref: windowRef }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    await sleep(500);

    // Restore for subsequent tests
    await bridge.send('raise', { ref: windowRef });
    await sleep(500);
  });

  test('move with invalid ref returns error', async () => {
    try {
      await bridge.send('move', { ref: '@w999', x: 0, y: 0 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005);
    }
  });

  test('move without coordinates returns error', async () => {
    try {
      await bridge.send('move', { ref: windowRef });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('resize without dimensions returns error', async () => {
    try {
      await bridge.send('resize', { ref: windowRef });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('close closes the window', async () => {
    // Create a new document to close (don't close our main window)
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1000);

    // Get the new window ref
    const winResult = await bridge.send('windows', { app: 'TextEdit' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    expect(windows.length).toBeGreaterThanOrEqual(1);
    const newRef = windows[0].ref;

    const result = await bridge.send('close', { ref: newRef }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    await sleep(500);
  });
});
