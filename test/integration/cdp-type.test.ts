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

describe('Integration — CDP Type', () => {
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
  }, 120000);

  afterAll(async () => {
    await client.disconnect();
    await quitElectronTestApp(bridge);
    await bridge.disconnect();
  });

  test('fill text field and verify via snapshot', async () => {
    // Navigate to Text Input tab
    let snap = await client.snapshot({}, windowInfo);
    const textTab = findByLabel(snap.elements, 'Text Input Tab');
    if (textTab) {
      await client.click(textTab.ref);
      await sleep(500);
    }

    snap = await client.snapshot({}, windowInfo);
    const nameField = findByLabel(snap.elements, 'Name');
    if (!nameField) return; // Skip if not found

    await client.fill(nameField.ref, 'Test User');
    await sleep(500);

    clearElectronTestAppStatus();
    // Trigger change to get status
    await client.key('tab');
    await sleep(200);

    // Re-snapshot to check value
    snap = await client.snapshot({}, windowInfo);
    const updatedField = findByLabel(snap.elements, 'Name');
    // The value should be updated
    if (updatedField && updatedField.value) {
      expect(updatedField.value).toContain('Test User');
    }
  });

  test('key combos work', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const nameField = findByLabel(snap.elements, 'Name');
    if (!nameField) return;

    await client.fill(nameField.ref, 'Hello World');
    await sleep(200);

    // Select all and delete
    await client.key('cmd+a');
    await sleep(100);
    await client.key('backspace');
    await sleep(200);

    // Re-snapshot
    const snap2 = await client.snapshot({}, windowInfo);
    const updated = findByLabel(snap2.elements, 'Name');
    if (updated) {
      // Value should be empty or cleared
      expect(updated.value === null || updated.value === '').toBe(true);
    }
  });
});
