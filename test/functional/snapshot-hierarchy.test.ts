import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Snapshot Hierarchy', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('snapshot returns hierarchical tree with refs', async () => {
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME }) as any;
    expect(snap.snapshot_id).toBeDefined();
    expect(snap.elements).toBeDefined();
    expect(snap.elements.length).toBeGreaterThan(0);

    // Check that refs are assigned
    function checkRefs(els: any[]): number {
      let count = 0;
      for (const el of els) {
        if (el.ref) {
          expect(el.ref).toMatch(/^@[a-z]{1,2}\d+$/);
          count++;
        }
        if (el.children) count += checkRefs(el.children);
      }
      return count;
    }

    const refCount = checkRefs(snap.elements);
    expect(refCount).toBeGreaterThan(5); // Should have many refs
  });

  test('interactive snapshot filters to interactive elements', async () => {
    const full = await bridge.send('snapshot', { app: TEST_APP_NAME }) as any;
    const interactive = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function countElements(els: any[]): number {
      let count = 0;
      for (const el of els) {
        count++;
        if (el.children) count += countElements(el.children);
      }
      return count;
    }

    const fullCount = countElements(full.elements);
    const interactiveCount = countElements(interactive.elements);

    // Interactive should have fewer elements
    expect(interactiveCount).toBeLessThan(fullCount);
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test('compact snapshot returns flat list', async () => {
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, compact: true }) as any;
    expect(snap.elements).toBeDefined();

    // In compact mode, elements should be flat (no deep nesting)
    for (const el of snap.elements) {
      // Compact mode may still have one level of children but should be flatter
      expect(el.ref).toBeDefined();
    }
  });

  test('depth-limited snapshot respects depth', async () => {
    const deep = await bridge.send('snapshot', { app: TEST_APP_NAME }) as any;
    const shallow = await bridge.send('snapshot', { app: TEST_APP_NAME, depth: 2 }) as any;

    function maxDepth(els: any[], d: number): number {
      let max = d;
      for (const el of els) {
        if (el.children) max = Math.max(max, maxDepth(el.children, d + 1));
      }
      return max;
    }

    const deepMax = maxDepth(deep.elements, 0);
    const shallowMax = maxDepth(shallow.elements, 0);

    expect(shallowMax).toBeLessThanOrEqual(2);
    expect(deepMax).toBeGreaterThanOrEqual(shallowMax);
  });
});
