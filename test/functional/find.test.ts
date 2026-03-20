import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Find', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('find by text returns matching elements', async () => {
    const result = await bridge.send('find', { text: 'Primary', app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);

    const match = result.elements.find((e: any) => e.label === 'Primary');
    expect(match).toBeDefined();
  });

  test('find by role returns matching elements', async () => {
    const result = await bridge.send('find', { role: 'button', app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);

    // All results should be buttons
    for (const el of result.elements) {
      expect(el.role).toBe('button');
    }
  });

  test('find with --first returns single element', async () => {
    const result = await bridge.send('find', { text: 'Primary', first: true, app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    expect(result.elements.length).toBe(1);
  });

  test('find nonexistent text returns empty', async () => {
    const result = await bridge.send('find', { text: 'XyzNonexistent123', app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    expect(result.elements.length).toBe(0);
  });
});
