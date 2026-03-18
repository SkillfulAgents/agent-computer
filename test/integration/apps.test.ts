import { describe, test, expect, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Apps', () => {
  const bridge = new Bridge({ timeout: 15000 });

  afterAll(async () => {
    // Clean up: make sure TextEdit is quit
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(200);
  });

  test('apps lists running applications', async () => {
    const result = await bridge.send('apps', { running: true }) as Record<string, unknown>;
    const apps = result.apps as Array<Record<string, unknown>>;
    expect(Array.isArray(apps)).toBe(true);
    expect(apps.length).toBeGreaterThan(0);

    // Finder should always be running
    const finder = apps.find(a => a.name === 'Finder');
    expect(finder).toBeDefined();
    expect(finder?.bundle_id).toBe('com.apple.finder');
    expect(typeof finder?.process_id).toBe('number');
  });

  test('apps returns app info with expected fields', async () => {
    const result = await bridge.send('apps', { running: true }) as Record<string, unknown>;
    const apps = result.apps as Array<Record<string, unknown>>;
    const app = apps[0];

    expect(app).toHaveProperty('name');
    expect(app).toHaveProperty('bundle_id');
    expect(app).toHaveProperty('process_id');
    expect(app).toHaveProperty('is_active');
    expect(app).toHaveProperty('is_hidden');
  });

  test('launch and quit TextEdit', { timeout: 30000 }, async () => {
    // Launch
    const launchResult = await bridge.send('launch', { name: 'TextEdit', wait: true }) as Record<string, unknown>;
    expect(launchResult.name).toBe('TextEdit');
    expect(launchResult.bundle_id).toBe('com.apple.TextEdit');
    expect(typeof launchResult.process_id).toBe('number');

    await sleep(500);

    // Verify it appears in running apps
    const appsResult = await bridge.send('apps', { running: true }) as Record<string, unknown>;
    const apps = appsResult.apps as Array<Record<string, unknown>>;
    const textEdit = apps.find(a => a.name === 'TextEdit');
    expect(textEdit).toBeDefined();

    // Quit
    const quitResult = await bridge.send('quit', { name: 'TextEdit' }) as Record<string, unknown>;
    expect(quitResult.ok).toBe(true);
    await sleep(1000);
  });

  test('launch nonexistent app returns APP_NOT_FOUND', async () => {
    try {
      await bridge.send('launch', { name: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32004);
    }
  });

  test('quit nonexistent app returns APP_NOT_FOUND', async () => {
    try {
      await bridge.send('quit', { name: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32004);
    }
  });
});
