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
    // Ungrab first
    await bridge.send('ungrab');
    try {
      await bridge.send('snapshot', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602); // INVALID_PARAMS
    }
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
