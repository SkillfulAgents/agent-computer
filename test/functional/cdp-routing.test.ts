import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import {
  launchElectronTestApp,
  quitElectronTestApp,
  clearElectronTestAppStatus,
  waitForElectronStatus,
  ELECTRON_CDP_PORT,
} from '../helpers/electron-test-app.js';
import { CDPClient } from '../../src/cdp/client.js';

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Functional — CDP Routing', () => {
  const bridge = new Bridge({ timeout: 30000 });
  let client: CDPClient;

  beforeAll(async () => {
    await launchElectronTestApp(bridge, ELECTRON_CDP_PORT);
    client = new CDPClient(ELECTRON_CDP_PORT);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client.disconnect();
    await quitElectronTestApp(bridge);
    await bridge.disconnect();
  });

  test('CDP client can take snapshot of Electron app', async () => {
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
    expect(snap.snapshot_id).toBeTruthy();
  });

  test('CDP click triggers status update', async () => {
    clearElectronTestAppStatus();

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

    const btn = findByLabel(snap.elements, 'Primary');
    if (btn) {
      await client.click(btn.ref);
      await sleep(500);
      const got = await waitForElectronStatus('clicked:Primary', 5000);
      expect(got).toBe(true);
    }
  });
});
