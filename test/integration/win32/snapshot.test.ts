import { describe, test, expect, afterEach } from 'vitest';
import { Bridge } from '../../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tree traversal helpers
function flattenElements(els: any[]): any[] {
  const result: any[] = [];
  const walk = (items: any[]) => {
    for (const el of items) {
      result.push(el);
      if (el.children) walk(el.children);
    }
  };
  walk(els);
  return result;
}

function countAll(els: any[]): number {
  let n = els.length;
  for (const el of els) {
    if (el.children) n += countAll(el.children);
  }
  return n;
}

function maxDepth(els: any[], d: number): number {
  let max = d;
  for (const el of els) {
    if (el.children) max = Math.max(max, maxDepth(el.children, d + 1));
  }
  return max;
}

describe('Snapshot — Notepad', () => {
  let bridge: Bridge;

  afterEach(async () => {
    try { await bridge.send('ungrab'); } catch { /* ok */ }
    try { await bridge.send('quit', { name: 'notepad', force: true }); } catch { /* ok */ }
    try { await bridge.shutdown(); } catch { /* ok */ }
    await sleep(500);
  });

  test('snapshot of app returns elements', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    // Take snapshot by app name (no grab needed)
    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('elements');

    const elements = result.elements as any[];
    expect(elements.length).toBeGreaterThan(0);
  });

  test('snapshot after grab returns elements', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    // Launch notepad and grab it
    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    // List windows first to confirm notepad is visible
    const winResult = await bridge.send('windows', { app: 'notepad' }) as Record<string, unknown>;
    const windows = winResult.windows as any[];
    expect(windows.length).toBeGreaterThan(0);

    // Grab by ref (more reliable than by app name)
    await bridge.send('grab', { ref: windows[0].ref });

    // Take snapshot with grab active
    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    expect(result).toHaveProperty('elements');

    const elements = result.elements as any[];
    expect(elements.length).toBeGreaterThan(0);
  });

  test('snapshot returns valid structure', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('elements');
    expect(typeof result.snapshot_id).toBe('string');
    // Elements should be a non-empty array
    expect(Array.isArray(result.elements)).toBe(true);
    expect((result.elements as any[]).length).toBeGreaterThan(0);
  });

  test('snapshot window info has expected fields', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const window = result.window as Record<string, unknown>;
    expect(window).toHaveProperty('ref');
    expect(window).toHaveProperty('title');
    expect(window).toHaveProperty('app');
    expect(window).toHaveProperty('bounds');
    expect(window).toHaveProperty('process_id');

    expect((window.app as string).toLowerCase()).toContain('notepad');
    expect(typeof window.process_id).toBe('number');
    expect((window.process_id as number)).toBeGreaterThan(0);

    const bounds = window.bounds as number[];
    expect(bounds).toHaveLength(4);
  });

  test('elements have required fields (ref, role, bounds)', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const elements = result.elements as any[];
    const flat = flattenElements(elements);
    expect(flat.length).toBeGreaterThan(0);

    // Check all elements have the core required fields
    for (const el of flat) {
      expect(el).toHaveProperty('ref');
      expect(el).toHaveProperty('role');
      expect(el).toHaveProperty('bounds');

      expect(typeof el.ref).toBe('string');
      expect(typeof el.role).toBe('string');
      expect(Array.isArray(el.bounds)).toBe(true);
      expect((el.bounds as number[]).length).toBe(4);
    }

    // label is optional on Windows (only present when element has a label)
    // Find at least one element that does have a label
    const withLabel = flat.filter(el => el.label !== undefined && el.label !== null);
    // It's OK if no elements have labels (some UIA trees are sparse),
    // but if they exist, they should be strings
    for (const el of withLabel) {
      expect(typeof el.label).toBe('string');
    }
  });

  test('element bounds have valid dimensions', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const elements = result.elements as any[];
    const flat = flattenElements(elements);

    // At least some elements should have non-zero bounds
    const withBounds = flat.filter(el => {
      const b = el.bounds as number[];
      return b[2] > 0 && b[3] > 0;
    });
    expect(withBounds.length).toBeGreaterThan(0);

    for (const el of withBounds) {
      const [, , w, h] = el.bounds;
      // x/y can be negative on Windows (multi-monitor, shadows), only check width/height
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });

  test('interactive snapshot filters non-interactive elements', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const full = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const interactive = await bridge.send('snapshot', { app: 'notepad', interactive: true }) as Record<string, unknown>;

    const fullCount = countAll(full.elements as any[]);
    const interactiveCount = countAll(interactive.elements as any[]);

    // Interactive should have fewer or equal elements
    expect(interactiveCount).toBeLessThanOrEqual(fullCount);

    // Interactive elements should be actionable roles
    const interactiveFlat = flattenElements(interactive.elements as any[]);
    // Should include buttons, textfields, etc. (not purely decorative elements)
    const hasInteractiveRole = interactiveFlat.some(el =>
      ['button', 'textfield', 'textarea', 'menuitem', 'checkbox', 'link',
        'radio', 'slider', 'dropdown', 'combobox', 'tab'].includes(el.role)
    );
    expect(hasInteractiveRole).toBe(true);
  });

  test('snapshot ID is unique per snapshot', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const r1 = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const r2 = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;

    expect(typeof r1.snapshot_id).toBe('string');
    expect(typeof r2.snapshot_id).toBe('string');
    expect(r1.snapshot_id).not.toBe(r2.snapshot_id);
  });

  test('snapshot ID is 8-char lowercase hex', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    expect(result.snapshot_id).toMatch(/^[0-9a-f]{8}$/);
  });

  test('refs follow expected format (@prefix + number)', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const flat = flattenElements(result.elements as any[]);
    expect(flat.length).toBeGreaterThan(0);

    // Valid ref prefixes: single letter (b, t, l, m, c, r, s, d, i, g, w, x, o, a, e)
    // or two-letter (cb, sa, st, sp, tl, pg, tv, wb)
    const refRegex = /^@[a-z]{1,2}\d+$/;
    for (const el of flat) {
      expect(el.ref).toMatch(refRegex);
    }
  });

  test('refs contain expected role-based prefixes', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const result = await bridge.send('snapshot', { app: 'notepad', interactive: true }) as Record<string, unknown>;
    const flat = flattenElements(result.elements as any[]);

    // Build a set of observed ref prefixes
    const prefixes = new Set<string>();
    for (const el of flat) {
      const match = (el.ref as string).match(/^@([a-z]{1,2})\d+$/);
      if (match) prefixes.add(match[1]);
    }

    // Notepad should have at minimum some buttons (@b) or text areas (@t) or generic (@e)
    const hasExpectedPrefix = prefixes.has('b') || prefixes.has('t') || prefixes.has('m') || prefixes.has('e');
    expect(hasExpectedPrefix).toBe(true);
  });

  test('refs reset between snapshots', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const s1 = await bridge.send('snapshot', { app: 'notepad', interactive: true }) as Record<string, unknown>;
    const s2 = await bridge.send('snapshot', { app: 'notepad', interactive: true }) as Record<string, unknown>;

    const flat1 = flattenElements(s1.elements as any[]);
    const flat2 = flattenElements(s2.elements as any[]);

    // Same elements should get same refs since counters reset per snapshot
    if (flat1.length > 0 && flat2.length > 0) {
      expect(flat1[0].ref).toBe(flat2[0].ref);
      expect(flat1[0].role).toBe(flat2[0].role);
    }
  });

  test('snapshot with depth limits nesting depth', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const d1 = await bridge.send('snapshot', { app: 'notepad', depth: 1 }) as Record<string, unknown>;
    const full = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;

    const d1Depth = maxDepth(d1.elements as any[], 0);
    const fullDepth = maxDepth(full.elements as any[], 0);

    // Depth-limited snapshot should have less or equal depth than the full snapshot
    expect(d1Depth).toBeLessThanOrEqual(fullDepth);
    // Depth=1 should have at most 1 level of children
    expect(d1Depth).toBeLessThanOrEqual(1);
  });

  test('depth=2 has more or equal nesting than depth=1', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const d1 = await bridge.send('snapshot', { app: 'notepad', depth: 1 }) as Record<string, unknown>;
    const d2 = await bridge.send('snapshot', { app: 'notepad', depth: 2 }) as Record<string, unknown>;

    const d1Depth = maxDepth(d1.elements as any[], 0);
    const d2Depth = maxDepth(d2.elements as any[], 0);
    expect(d2Depth).toBeGreaterThanOrEqual(d1Depth);
  });

  test('snapshot without app or grabbed window returns error', { timeout: 15000 }, async () => {
    bridge = new Bridge({ timeout: 15000 });

    // Ensure daemon is running and nothing is grabbed
    await bridge.send('ping');
    try { await bridge.send('ungrab'); } catch { /* ok */ }

    try {
      await bridge.send('snapshot', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      // Windows daemon returns WINDOW_NOT_FOUND (-32005) when no target is specified
      // macOS returns INVALID_PARAMS (-32602)
      expect([-32602, -32005]).toContain(err.code);
    }
  });

  test('snapshot with nonexistent app returns error', { timeout: 15000 }, async () => {
    bridge = new Bridge({ timeout: 15000 });
    await bridge.send('ping');

    try {
      await bridge.send('snapshot', { app: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      // Windows daemon may return WINDOW_NOT_FOUND (-32005) or APP_NOT_FOUND (-32004)
      expect([-32004, -32005]).toContain(err.code);
    }
  });

  test('compact snapshot has fewer top-level elements', { timeout: 30000 }, async () => {
    bridge = new Bridge({ timeout: 20000 });

    await bridge.send('launch', { name: 'notepad' });
    await sleep(2000);

    const full = await bridge.send('snapshot', { app: 'notepad' }) as Record<string, unknown>;
    const compact = await bridge.send('snapshot', { app: 'notepad', compact: true }) as Record<string, unknown>;

    const fullElements = full.elements as any[];
    const compactElements = compact.elements as any[];

    expect(compactElements.length).toBeGreaterThan(0);
    expect(fullElements.length).toBeGreaterThan(0);

    // Compact should have fewer or equal total elements (flattened) than full
    const fullCount = countAll(fullElements);
    const compactCount = countAll(compactElements);
    expect(compactCount).toBeLessThanOrEqual(fullCount);
  });
});
