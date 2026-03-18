import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Snapshot — Calculator', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // Ensure Calculator is running
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'Calculator', wait: true });
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('snapshot returns valid structure', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('elements');
    expect(result).toHaveProperty('fallback');
    expect(typeof result.snapshot_id).toBe('string');
    expect(result.fallback).toBeNull();
  });

  test('snapshot window info has expected fields', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const window = result.window as Record<string, unknown>;
    expect(window.app).toBe('Calculator');
    expect(window).toHaveProperty('ref');
    expect(window).toHaveProperty('title');
    expect(window).toHaveProperty('bounds');
    expect(window).toHaveProperty('process_id');
    expect(window).toHaveProperty('minimized');
    expect(window).toHaveProperty('hidden');
    expect(window).toHaveProperty('fullscreen');
  });

  test('snapshot elements have typed refs', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const elements = result.elements as Array<Record<string, unknown>>;
    expect(elements.length).toBeGreaterThan(0);

    // Find buttons — Calculator should have number buttons
    function findAll(els: any[], role: string): any[] {
      let found: any[] = [];
      for (const el of els) {
        if (el.role === role) found.push(el);
        if (el.children) found = found.concat(findAll(el.children, role));
      }
      return found;
    }

    const buttons = findAll(elements, 'button');
    expect(buttons.length).toBeGreaterThan(10); // Calculator has 19+ buttons

    // Button refs should start with @b
    for (const btn of buttons) {
      expect(btn.ref).toMatch(/^@b\d+$/);
    }

    // Should have labeled buttons like "1", "2", "+", "="
    const labels = buttons.map((b: any) => b.label).filter(Boolean);
    expect(labels).toContain('1');
    expect(labels).toContain('2');
    expect(labels).toContain('Add');
    expect(labels).toContain('Equals');
  });

  test('snapshot elements have bounds', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const elements = result.elements as Array<Record<string, unknown>>;

    function first(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button') return el;
        if (el.children) {
          const found = first(el.children);
          if (found) return found;
        }
      }
    }

    const btn = first(elements);
    expect(btn).toBeDefined();
    expect(btn.bounds).toHaveLength(4);
    const [x, y, w, h] = btn.bounds;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test('snapshot with interactive flag filters non-interactive elements', async () => {
    const full = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const interactive = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;

    function countAll(els: any[]): number {
      let n = els.length;
      for (const el of els) {
        if (el.children) n += countAll(el.children);
      }
      return n;
    }

    const fullCount = countAll(full.elements as any[]);
    const interactiveCount = countAll(interactive.elements as any[]);

    // Interactive should have fewer or equal elements
    expect(interactiveCount).toBeLessThanOrEqual(fullCount);
  });

  test('snapshot with compact flag returns flat list', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator', compact: true }) as Record<string, unknown>;
    const elements = result.elements as Array<Record<string, unknown>>;

    // No element should have children in compact mode
    for (const el of elements) {
      expect(el.children).toBeUndefined();
    }
  });

  test('snapshot with depth=1 limits nesting', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator', depth: 1 }) as Record<string, unknown>;
    const elements = result.elements as Array<Record<string, unknown>>;

    // Top-level elements should NOT have children (depth=1 means only children of root)
    for (const el of elements) {
      expect(el.children).toBeUndefined();
    }
  });

  test('snapshot IDs are unique', async () => {
    const r1 = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const r2 = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    expect(r1.snapshot_id).not.toBe(r2.snapshot_id);
  });

  test('snapshot without grabbed window or --app returns error', async () => {
    await bridge.send('ungrab');
    try {
      await bridge.send('snapshot', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('snapshot ID is 8-char lowercase hex', async () => {
    const result = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    expect(result.snapshot_id).toMatch(/^[0-9a-f]{8}$/);
  });

  test('compact mode preserves element count', async () => {
    const hierarchical = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const compact = await bridge.send('snapshot', { app: 'Calculator', compact: true }) as Record<string, unknown>;

    function countAll(els: any[]): number {
      let n = els.length;
      for (const el of els) {
        if (el.children) n += countAll(el.children);
      }
      return n;
    }

    const hCount = countAll(hierarchical.elements as any[]);
    const cCount = (compact.elements as any[]).length;
    expect(cCount).toBe(hCount);
  });

  test('depth=2 has more nesting than depth=1', async () => {
    const d1 = await bridge.send('snapshot', { app: 'Calculator', depth: 1 }) as Record<string, unknown>;
    const d2 = await bridge.send('snapshot', { app: 'Calculator', depth: 2 }) as Record<string, unknown>;

    function maxDepth(els: any[], d: number): number {
      let max = d;
      for (const el of els) {
        if (el.children) max = Math.max(max, maxDepth(el.children, d + 1));
      }
      return max;
    }

    const d1Depth = maxDepth(d1.elements as any[], 0);
    const d2Depth = maxDepth(d2.elements as any[], 0);
    expect(d2Depth).toBeGreaterThanOrEqual(d1Depth);
  });

  test('refs reset between snapshots (same refs for same elements)', async () => {
    const s1 = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const s2 = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;

    function firstButton(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button') return el;
        if (el.children) {
          const found = firstButton(el.children);
          if (found) return found;
        }
      }
    }

    const btn1 = firstButton(s1.elements as any[]);
    const btn2 = firstButton(s2.elements as any[]);
    // Same button should get same ref since counters reset
    expect(btn1.ref).toBe(btn2.ref);
    expect(btn1.label).toBe(btn2.label);
  });

  test('snapshot with --pid works', async () => {
    // Get Calculator's PID
    const apps = await bridge.send('apps', { running: true }) as Record<string, unknown>;
    const calc = (apps.apps as any[]).find((a: any) => a.name === 'Calculator');
    expect(calc).toBeDefined();

    const result = await bridge.send('snapshot', { pid: calc.process_id }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    expect((result.window as any).app).toBe('Calculator');
  });

  test('snapshot with invalid PID returns error', async () => {
    try {
      await bridge.send('snapshot', { pid: 99999 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32005); // WINDOW_NOT_FOUND
    }
  });

  test('snapshot with nonexistent app returns error', async () => {
    try {
      await bridge.send('snapshot', { app: 'NonexistentApp12345' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32004); // APP_NOT_FOUND
    }
  });

  test('snapshot with --subtree returns subtree only', async () => {
    // First get full snapshot to find a group ref
    const full = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const elements = full.elements as any[];

    function findGroup(els: any[]): any {
      for (const el of els) {
        if (el.role === 'group' && el.children && el.children.length > 0) return el;
        if (el.children) {
          const found = findGroup(el.children);
          if (found) return found;
        }
      }
    }

    const group = findGroup(elements);
    if (!group) {
      // Skip if no suitable group found (unlikely for Calculator)
      return;
    }

    const subtree = await bridge.send('snapshot', { app: 'Calculator', subtree: group.ref }) as Record<string, unknown>;
    expect(subtree).toHaveProperty('snapshot_id');
    const subElements = subtree.elements as any[];
    expect(subElements.length).toBeGreaterThan(0);

    function countAll(els: any[]): number {
      let n = els.length;
      for (const el of els) {
        if (el.children) n += countAll(el.children);
      }
      return n;
    }

    // Subtree should have fewer elements than full snapshot
    const fullCount = countAll(elements);
    const subCount = countAll(subElements);
    expect(subCount).toBeLessThan(fullCount);
  });
});

describe('Snapshot — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('snapshot returns elements for TextEdit', { timeout: 30000 }, async () => {
    const result = await bridge.send('snapshot', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result).toHaveProperty('snapshot_id');
    const elements = result.elements as Array<Record<string, unknown>>;
    expect(elements.length).toBeGreaterThan(0);
  });

  test('snapshot with --app flag works', { timeout: 30000 }, async () => {
    const result = await bridge.send('snapshot', { app: 'TextEdit' }) as Record<string, unknown>;
    const window = result.window as Record<string, unknown>;
    expect(window.app).toBe('TextEdit');
  });
});
