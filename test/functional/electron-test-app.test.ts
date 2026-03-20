import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import {
  buildElectronTestApp,
  launchElectronTestApp,
  quitElectronTestApp,
  clearElectronTestAppStatus,
  waitForElectronStatus,
  ELECTRON_CDP_PORT,
} from '../helpers/electron-test-app.js';
import { discoverTargets } from '../../src/cdp/discovery.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Functional — Electron Test App', () => {
  const bridge = new Bridge({ timeout: 30000 });

  beforeAll(async () => {
    await launchElectronTestApp(bridge, ELECTRON_CDP_PORT);
  }, 120000);

  afterAll(async () => {
    await quitElectronTestApp(bridge);
    await bridge.disconnect();
  });

  test('app launches successfully', () => {
    // If we got here, launchElectronTestApp succeeded
    expect(true).toBe(true);
  });

  test('CDP endpoint is reachable', async () => {
    const targets = await discoverTargets(ELECTRON_CDP_PORT);
    expect(targets.length).toBeGreaterThan(0);

    const page = targets.find(t => t.type === 'page');
    expect(page).toBeDefined();
    expect(page!.webSocketDebuggerUrl).toBeTruthy();
  });

  test('status file side-channel works', async () => {
    clearElectronTestAppStatus();

    // Connect CDP and click a button to trigger status write
    const { CDPClient } = await import('../../src/cdp/client.js');
    const client = new CDPClient(ELECTRON_CDP_PORT);
    await client.connect();

    try {
      const snap = await client.snapshot({}, {
        ref: '@w1',
        title: 'AC Electron Test App',
        app: 'Electron',
        process_id: 0,
        bounds: [0, 0, 600, 500],
        minimized: false,
        hidden: false,
        fullscreen: false,
      });

      expect(snap.elements.length).toBeGreaterThan(0);

      // Find and click the Primary button
      function findByLabel(els: any[], label: string): any {
        for (const el of els) {
          if (el.label === label) return el;
          if (el.children) {
            const found = findByLabel(el.children, label);
            if (found) return found;
          }
        }
        return null;
      }

      const primaryBtn = findByLabel(snap.elements, 'Primary');
      if (primaryBtn) {
        await client.click(primaryBtn.ref);
        await sleep(500);
        const gotStatus = await waitForElectronStatus('clicked:Primary', 5000);
        expect(gotStatus).toBe(true);
      }
    } finally {
      await client.disconnect();
    }
  }, 30000);
});
