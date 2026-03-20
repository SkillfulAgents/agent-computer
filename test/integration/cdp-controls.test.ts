import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { CDPClient } from '../../src/cdp/client.js';
import {
  launchElectronTestApp,
  quitElectronTestApp,
  clearElectronTestAppStatus,
  waitForElectronStatus,
  ELECTRON_CDP_PORT,
} from '../helpers/electron-test-app.js';

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

describe('Integration — CDP Controls', () => {
  const bridge = new Bridge({ timeout: 30000 });
  let client: CDPClient;
  const windowInfo = {
    ref: '@w1',
    title: 'AC Electron Test App',
    app: 'Electron',
    process_id: 0,
    bounds: [0, 0, 600, 500] as [number, number, number, number],
    minimized: false,
    hidden: false,
    fullscreen: false,
  };

  beforeAll(async () => {
    await launchElectronTestApp(bridge, ELECTRON_CDP_PORT);
    client = new CDPClient(ELECTRON_CDP_PORT);
    await client.connect();

    // Navigate to Controls tab
    const snap = await client.snapshot({}, windowInfo);
    const controlsTab = findByLabel(snap.elements, 'Controls Tab');
    if (controlsTab) {
      await client.click(controlsTab.ref);
      await sleep(500);
    }
  }, 120000);

  afterAll(async () => {
    await client.disconnect();
    await quitElectronTestApp(bridge);
    await bridge.disconnect();
  });

  test('check checkbox', async () => {
    clearElectronTestAppStatus();
    const snap = await client.snapshot({}, windowInfo);
    const checkbox = findByLabel(snap.elements, 'Option A');
    if (!checkbox) return;

    await client.check(checkbox.ref);
    await sleep(500);

    const gotStatus = await waitForElectronStatus('checked:Option A', 5000);
    expect(gotStatus).toBe(true);
  });

  test('select dropdown value', async () => {
    clearElectronTestAppStatus();
    const snap = await client.snapshot({}, windowInfo);
    const dropdown = findByLabel(snap.elements, 'Color Select');
    if (!dropdown) return;

    await client.select(dropdown.ref, 'Blue');
    await sleep(500);

    const gotStatus = await waitForElectronStatus('selected:Blue', 5000);
    expect(gotStatus).toBe(true);
  });
});
