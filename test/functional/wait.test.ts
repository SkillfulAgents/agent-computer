import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Wait', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('wait ms pauses for specified duration', async () => {
    const start = Date.now();
    await bridge.send('wait', { ms: 500 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(400); // allow some slack
    expect(elapsed).toBeLessThan(2000);
  });

  test('wait for app succeeds for running app', async () => {
    const result = await bridge.send('wait', { app: TEST_APP_NAME, timeout: 5000 }) as any;
    expect(result.ok).toBe(true);
  });

  test('wait for app times out for nonexistent app', async () => {
    try {
      await bridge.send('wait', { app: 'NonexistentApp12345', timeout: 1000 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32003); // timeout
    }
  });

  test('wait for text succeeds when text is present', async () => {
    // Grab the test app so wait searches its window
    await bridge.send('grab', { app: TEST_APP_NAME });
    await sleep(300);
    const result = await bridge.send('wait', {
      text: 'Buttons',
      timeout: 5000
    }) as any;
    expect(result.ok).toBe(true);
    await bridge.send('ungrab');
  });
});
