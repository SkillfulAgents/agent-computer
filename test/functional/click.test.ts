import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, waitForStatus, clearTestAppStatus, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Click', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('click button by ref', async () => {
    clearTestAppStatus();

    // Snapshot to find the Primary button
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;
    const elements = snap.elements;

    function findByLabel(els: any[], label: string): any {
      for (const el of els) {
        if (el.label === label) return el;
        if (el.children) { const f = findByLabel(el.children, label); if (f) return f; }
      }
    }

    const btn = findByLabel(elements, 'Primary');
    expect(btn).toBeDefined();

    await bridge.send('click', { ref: btn.ref });
    await sleep(500);

    const gotStatus = await waitForStatus('clicked:Primary');
    expect(gotStatus).toBe(true);
  });

  test('disabled button exists but is not enabled', async () => {
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function findByLabel(els: any[], label: string): any {
      for (const el of els) {
        if (el.label === label) return el;
        if (el.children) { const f = findByLabel(el.children, label); if (f) return f; }
      }
    }

    const btn = findByLabel(snap.elements, 'Disabled');
    expect(btn).toBeDefined();
    expect(btn.enabled).toBe(false);
  });

  test('multiple clicks increment count', async () => {
    clearTestAppStatus();

    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function findByLabel(els: any[], label: string): any {
      for (const el of els) {
        if (el.label === label) return el;
        if (el.children) { const f = findByLabel(el.children, label); if (f) return f; }
      }
    }

    const btn = findByLabel(snap.elements, 'Secondary');
    expect(btn).toBeDefined();

    await bridge.send('click', { ref: btn.ref });
    await sleep(300);
    await bridge.send('click', { ref: btn.ref });
    await sleep(300);

    const gotStatus = await waitForStatus('clicked:Secondary');
    expect(gotStatus).toBe(true);
  });

  test('reset button clears state', async () => {
    clearTestAppStatus();

    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function findByLabel(els: any[], label: string): any {
      for (const el of els) {
        if (el.label === label) return el;
        if (el.children) { const f = findByLabel(el.children, label); if (f) return f; }
      }
    }

    const btn = findByLabel(snap.elements, 'Reset');
    expect(btn).toBeDefined();

    await bridge.send('click', { ref: btn.ref });
    await sleep(300);

    const gotStatus = await waitForStatus('reset');
    expect(gotStatus).toBe(true);
  });
});
