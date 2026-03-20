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

describe('E2E — CDP Form Filling', () => {
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

  test('full form workflow: navigate → fill → submit', async () => {
    // Navigate to Form tab
    let snap = await client.snapshot({}, windowInfo);
    const formTab = findByLabel(snap.elements, 'Form Tab');
    if (formTab) {
      await client.click(formTab.ref);
      await sleep(500);
    }

    // Fill form fields
    snap = await client.snapshot({}, windowInfo);

    const firstName = findByLabel(snap.elements, 'First Name');
    if (firstName) {
      await client.fill(firstName.ref, 'John');
      await sleep(200);
    }

    const lastName = findByLabel(snap.elements, 'Last Name');
    if (lastName) {
      await client.fill(lastName.ref, 'Doe');
      await sleep(200);
    }

    const email = findByLabel(snap.elements, 'Email');
    if (email) {
      await client.fill(email.ref, 'john@example.com');
      await sleep(200);
    }

    const age = findByLabel(snap.elements, 'Age');
    if (age) {
      await client.fill(age.ref, '30');
      await sleep(200);
    }

    // Check agree checkbox
    snap = await client.snapshot({}, windowInfo);
    const agree = findByLabel(snap.elements, 'Agree to Terms');
    if (agree) {
      await client.check(agree.ref);
      await sleep(300);
    }

    // Submit form
    clearElectronTestAppStatus();
    snap = await client.snapshot({}, windowInfo);
    const submitBtn = findByLabel(snap.elements, 'Submit');
    if (submitBtn) {
      await client.click(submitBtn.ref);
      await sleep(500);

      const gotStatus = await waitForElectronStatus('form:submitted', 5000);
      expect(gotStatus).toBe(true);
    }
  }, 60000);

  test('reset form clears fields', async () => {
    clearElectronTestAppStatus();
    const snap = await client.snapshot({}, windowInfo);
    const resetBtn = findByLabel(snap.elements, 'Reset');
    if (resetBtn) {
      await client.click(resetBtn.ref);
      await sleep(500);

      const gotStatus = await waitForElectronStatus('form:reset', 5000);
      expect(gotStatus).toBe(true);
    }
  });
});
