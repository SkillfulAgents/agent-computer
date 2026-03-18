import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { existsSync, unlinkSync, statSync } from 'fs';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Screenshot', () => {
  const bridge = new Bridge({ timeout: 20000 });
  const testDir = '/tmp/ac-test-screenshots';

  beforeAll(async () => {
    // Ensure Calculator is running for window screenshots
    try { await bridge.send('launch', { name: 'Calculator', wait: true }); } catch { /* ok */ }
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
    // Clean up test screenshots
    try {
      const { readdirSync } = await import('fs');
      for (const f of readdirSync(testDir)) {
        unlinkSync(`${testDir}/${f}`);
      }
    } catch { /* ok */ }
  });

  test('screenshot creates a PNG file', async () => {
    const path = `${testDir}/test-basic.png`;
    try { unlinkSync(path); } catch { /* ok */ }

    const result = await bridge.send('screenshot', { path, screen: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.path).toBe(path);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(existsSync(path)).toBe(true);

    // File should have reasonable size (> 1KB)
    const stat = statSync(path);
    expect(stat.size).toBeGreaterThan(1000);
  });

  test('screenshot with JPEG format works', async () => {
    const path = `${testDir}/test-jpeg.jpg`;
    try { unlinkSync(path); } catch { /* ok */ }

    const result = await bridge.send('screenshot', { path, screen: true, format: 'jpeg' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.path).toBe(path);
    expect(existsSync(path)).toBe(true);
  });

  test('screenshot of specific window works', async () => {
    // Get Calculator window
    const winResult = await bridge.send('windows', { app: 'Calculator' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    expect(windows.length).toBeGreaterThan(0);
    const windowRef = windows[0].ref;

    const path = `${testDir}/test-window.png`;
    try { unlinkSync(path); } catch { /* ok */ }

    const result = await bridge.send('screenshot', { ref: windowRef, path }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    // Window screenshot should be smaller than full screen
    const screenResult = await bridge.send('screenshot', { path: `${testDir}/test-screen-compare.png`, screen: true }) as Record<string, unknown>;
    const screenPixels = (screenResult.width as number) * (screenResult.height as number);
    const windowPixels = (result.width as number) * (result.height as number);
    expect(windowPixels).toBeLessThanOrEqual(screenPixels);
  });

  test('screenshot auto-generates path when not specified', async () => {
    const result = await bridge.send('screenshot', { screen: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.path).toBeDefined();
    expect(typeof result.path).toBe('string');
    expect(existsSync(result.path as string)).toBe(true);

    // Cleanup
    try { unlinkSync(result.path as string); } catch { /* ok */ }
  });

  test('screenshot returns correct dimensions', async () => {
    const path = `${testDir}/test-dims.png`;
    try { unlinkSync(path); } catch { /* ok */ }

    const result = await bridge.send('screenshot', { path, screen: true }) as Record<string, unknown>;
    expect(result.width).toBeGreaterThan(100);
    expect(result.height).toBeGreaterThan(100);
  });
});

describe('Displays', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('displays returns at least one display', async () => {
    const result = await bridge.send('displays') as Record<string, unknown>;
    const displays = result.displays as any[];
    expect(Array.isArray(displays)).toBe(true);
    expect(displays.length).toBeGreaterThan(0);
  });

  test('display has expected fields', async () => {
    const result = await bridge.send('displays') as Record<string, unknown>;
    const displays = result.displays as any[];
    const display = displays[0];

    expect(display).toHaveProperty('id');
    expect(display).toHaveProperty('width');
    expect(display).toHaveProperty('height');
    expect(display).toHaveProperty('x');
    expect(display).toHaveProperty('y');
    expect(display).toHaveProperty('is_main');
    expect(display).toHaveProperty('scale_factor');

    expect(display.width).toBeGreaterThan(0);
    expect(display.height).toBeGreaterThan(0);
    expect(typeof display.is_main).toBe('boolean');
    expect(display.scale_factor).toBeGreaterThanOrEqual(1);
  });

  test('at least one display is main', async () => {
    const result = await bridge.send('displays') as Record<string, unknown>;
    const displays = result.displays as any[];
    const mainDisplay = displays.find((d: any) => d.is_main);
    expect(mainDisplay).toBeDefined();
  });
});
