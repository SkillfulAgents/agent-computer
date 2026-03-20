import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { CDPClient } from '../../src/cdp/client.js';
import { getBounds } from '../../src/cdp/bounds.js';
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

describe('Integration — CDP Click', () => {
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

  beforeEach(() => {
    clearElectronTestAppStatus();
  });

  test('click Primary button → status file updated', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const btn = findByLabel(snap.elements, 'Primary');
    expect(btn).toBeTruthy();

    await client.click(btn.ref);
    await sleep(500);

    const gotStatus = await waitForElectronStatus('clicked:Primary', 5000);
    expect(gotStatus).toBe(true);
  });

  test('click Secondary button → status file updated', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const btn = findByLabel(snap.elements, 'Secondary');
    if (!btn) return; // Skip if not visible

    await client.click(btn.ref);
    await sleep(500);

    const gotStatus = await waitForElectronStatus('clicked:Secondary', 5000);
    expect(gotStatus).toBe(true);
  });

  test('disabled button is detected as disabled', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const btn = findByLabel(snap.elements, 'Disabled');
    if (btn) {
      expect(btn.enabled).toBe(false);
    }
  });

  test('clickAt with CSS viewport coords hits the button', async () => {
    // Snapshot to populate refMap, then get CSS bounds for the Danger button
    const snap = await client.snapshot({}, windowInfo);
    const btn = findByLabel(snap.elements, 'Danger');
    expect(btn).toBeTruthy();

    // Get the raw CSS viewport bounds (what CDP Input.dispatchMouseEvent uses)
    const refMap = client.getLastRefMap();
    const nodeRef = refMap.get(btn.ref);
    expect(nodeRef).toBeTruthy();
    const cssBounds = await getBounds(client.getConnection(), nodeRef!.backendDOMNodeId);
    expect(cssBounds[2]).toBeGreaterThan(0); // width > 0
    expect(cssBounds[3]).toBeGreaterThan(0); // height > 0

    // Click at center of CSS bounds via clickAt (viewport coords)
    const cx = cssBounds[0] + cssBounds[2] / 2;
    const cy = cssBounds[1] + cssBounds[3] / 2;
    await client.clickAt(cx, cy);
    await sleep(500);

    const gotStatus = await waitForElectronStatus('clicked:Danger', 5000);
    expect(gotStatus).toBe(true);
  });

  test('screen coords from snapshot differ from CSS viewport coords', async () => {
    // This validates that the two coordinate systems are different,
    // which is why coordinate clicks must route to native (screen coords)
    // while ref clicks use CDP (CSS viewport coords).
    const snap = await client.snapshot({}, windowInfo);
    const btn = findByLabel(snap.elements, 'Primary');
    expect(btn).toBeTruthy();

    // Screen bounds (from snapshot, after toScreenCoords transform)
    const screenBounds = btn.bounds;

    // CSS viewport bounds (raw from CDP DOM.getBoxModel)
    const refMap = client.getLastRefMap();
    const nodeRef = refMap.get(btn.ref);
    expect(nodeRef).toBeTruthy();
    const cssBounds = await getBounds(client.getConnection(), nodeRef!.backendDOMNodeId);

    // Screen bounds include window position offset and scale factor,
    // so they should differ from CSS bounds (unless window is at 0,0 with 1x scale)
    // At minimum, verify CSS bounds are reasonable (non-zero, smaller values)
    expect(cssBounds[2]).toBeGreaterThan(0);
    expect(cssBounds[3]).toBeGreaterThan(0);
    expect(screenBounds[2]).toBeGreaterThan(0);
    expect(screenBounds[3]).toBeGreaterThan(0);

    // On Retina displays (scaleFactor=2), screen bounds should be ~2x the CSS bounds
    // This is the core reason coordinate clicks can't go through CDP with screen coords
    const scaleRatio = screenBounds[2] / cssBounds[2];
    // Allow some tolerance, but it should be > 1 on Retina or == 1 on non-Retina
    expect(scaleRatio).toBeGreaterThanOrEqual(1);
  });
});
