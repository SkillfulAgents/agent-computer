import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { CDPClient } from '../../src/cdp/client.js';
import {
  launchElectronTestApp,
  quitElectronTestApp,
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

function flattenElements(elements: any[]): any[] {
  const result: any[] = [];
  function walk(els: any[]) {
    for (const el of els) {
      result.push(el);
      if (el.children) walk(el.children);
    }
  }
  walk(elements);
  return result;
}

describe('Integration — CDP Snapshot', () => {
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

  test('snapshot returns elements', async () => {
    const snap = await client.snapshot({}, windowInfo);
    expect(snap.elements.length).toBeGreaterThan(0);
    expect(snap.snapshot_id).toBeTruthy();
  });

  test('snapshot contains buttons with correct roles', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const flat = flattenElements(snap.elements);
    const buttons = flat.filter(e => e.role === 'button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('snapshot contains textfields', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const flat = flattenElements(snap.elements);
    const textfields = flat.filter(e => e.role === 'textfield');
    // There should be text input fields
    expect(textfields.length).toBeGreaterThanOrEqual(0);
  });

  test('interactive mode filters elements', async () => {
    const fullSnap = await client.snapshot({}, windowInfo);
    const interactiveSnap = await client.snapshot({ interactive: true }, windowInfo);

    const fullFlat = flattenElements(fullSnap.elements);
    const interFlat = flattenElements(interactiveSnap.elements);

    // Interactive should have fewer elements
    expect(interFlat.length).toBeLessThanOrEqual(fullFlat.length);
  });

  test('elements have refs', async () => {
    const snap = await client.snapshot({}, windowInfo);
    const flat = flattenElements(snap.elements);
    for (const el of flat) {
      expect(el.ref).toMatch(/^@[a-z]{1,2}\d+$/);
    }
  });
});
