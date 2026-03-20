import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { CDPClient } from '../../src/cdp/client.js';
import {
  launchElectronTestApp,
  quitElectronTestApp,
  ELECTRON_CDP_PORT,
} from '../helpers/electron-test-app.js';
import { discoverTargets } from '../../src/cdp/discovery.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Functional — CDP Relaunch', () => {
  const bridge = new Bridge({ timeout: 30000 });

  beforeAll(async () => {
    await launchElectronTestApp(bridge, ELECTRON_CDP_PORT);
  }, 120000);

  afterAll(async () => {
    await quitElectronTestApp(bridge);
    await bridge.disconnect();
  });

  test('CDP is active after launch', async () => {
    const targets = await discoverTargets(ELECTRON_CDP_PORT);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.some(t => t.type === 'page')).toBe(true);
  });

  test('snapshot works after launch', async () => {
    const client = new CDPClient(ELECTRON_CDP_PORT);
    await client.connect();

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
    await client.disconnect();
  });
});
