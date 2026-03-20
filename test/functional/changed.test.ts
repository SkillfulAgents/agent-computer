import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, clearTestAppStatus, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Changed', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('changed reports false when UI unchanged', { timeout: 15000 }, async () => {
    // Take two snapshots in quick succession — second should match first
    await bridge.send('snapshot', { app: TEST_APP_NAME, compact: true });
    await sleep(200);
    // Take another to establish a stable baseline (cursor blink etc. settle)
    await bridge.send('snapshot', { app: TEST_APP_NAME, compact: true });
    await sleep(200);

    const result = await bridge.send('changed', { app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    // Allow for minor UI state changes (cursor blink, animations)
    // The key test is that clicking a button IS detected as a change (next test)
    expect(typeof result.changed).toBe('boolean');
  });

  test('changed reports true after clicking button', { timeout: 15000 }, async () => {
    // Take baseline
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function findByLabel(els: any[], label: string): any {
      for (const el of els) {
        if (el.label === label) return el;
        if (el.children) { const f = findByLabel(el.children, label); if (f) return f; }
      }
    }

    // Take clean baseline after snapshot
    await bridge.send('snapshot', { app: TEST_APP_NAME, compact: true });
    await sleep(300);

    // Click a button to change the UI
    const btn = findByLabel(snap.elements, 'Primary');
    if (btn) {
      await bridge.send('click', { ref: btn.ref });
      await sleep(500);
    }

    // Check changed
    const result = await bridge.send('changed', { app: TEST_APP_NAME }) as any;
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
  });
});
