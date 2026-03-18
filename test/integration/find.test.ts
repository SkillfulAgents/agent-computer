import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Find', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('launch', { name: 'Calculator', wait: true }); } catch { /* ok */ }
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('find by text returns matches', async () => {
    const result = await bridge.send('find', { text: 'Add', app: 'Calculator' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    const elements = result.elements as any[];
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0]).toHaveProperty('ref');
    expect(elements[0]).toHaveProperty('role');
  });

  test('find by role returns matches', async () => {
    const result = await bridge.send('find', { role: 'button', app: 'Calculator' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    const elements = result.elements as any[];
    expect(elements.length).toBeGreaterThan(10); // Calculator has many buttons
  });

  test('find with --first returns one result', async () => {
    const result = await bridge.send('find', { role: 'button', first: true, app: 'Calculator' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    const elements = result.elements as any[];
    expect(elements.length).toBe(1);
  });

  test('find by text and role combined', async () => {
    const result = await bridge.send('find', { text: 'Add', role: 'button', app: 'Calculator' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    const elements = result.elements as any[];
    expect(elements.length).toBeGreaterThan(0);
    // Should only find buttons labeled "Add"
    for (const el of elements) {
      expect(el.role).toBe('button');
    }
  });

  test('find nonexistent text returns empty', async () => {
    const result = await bridge.send('find', { text: 'NonexistentElement12345', app: 'Calculator' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  test('find without text or role returns error', async () => {
    try {
      await bridge.send('find', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Read & Inspect', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('launch', { name: 'Calculator', wait: true }); } catch { /* ok */ }
    await sleep(1000);
    // Take snapshot to populate ref map
    await bridge.send('snapshot', { app: 'Calculator', interactive: true });
  }, 30000);

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('read returns element value', async () => {
    // Find a button first
    const findResult = await bridge.send('find', { role: 'button', first: true, app: 'Calculator' }) as Record<string, unknown>;
    const elements = findResult.elements as any[];
    expect(elements.length).toBeGreaterThan(0);
    const ref = elements[0].ref;

    const result = await bridge.send('read', { ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(ref);
    expect(result).toHaveProperty('role');
  });

  test('read with --attr returns specific attribute', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];

    function findButton(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button' && el.label) return el;
        if (el.children) { const f = findButton(el.children); if (f) return f; }
      }
    }
    const btn = findButton(els);
    expect(btn).toBeDefined();

    const result = await bridge.send('read', { ref: btn.ref, attr: 'AXRole' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.attr).toBe('AXRole');
  });

  test('read nonexistent ref returns error', async () => {
    await bridge.send('snapshot', { app: 'Calculator' });
    try {
      await bridge.send('read', { ref: '@b999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('title returns window title', async () => {
    const result = await bridge.send('title', {}) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('title');
  });

  test('title with --app returns app name', async () => {
    const result = await bridge.send('title', { app: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('title');
  });

  test('is visible returns boolean', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];
    function findButton(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button') return el;
        if (el.children) { const f = findButton(el.children); if (f) return f; }
      }
    }
    const btn = findButton(els);
    expect(btn).toBeDefined();

    const result = await bridge.send('is', { state: 'visible', ref: btn.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.state).toBe('visible');
    expect(typeof result.value).toBe('boolean');
    expect(result.value).toBe(true);
  });

  test('is enabled returns boolean', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];
    function findButton(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button') return el;
        if (el.children) { const f = findButton(el.children); if (f) return f; }
      }
    }
    const btn = findButton(els);

    const result = await bridge.send('is', { state: 'enabled', ref: btn.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  test('is with invalid state returns error', async () => {
    await bridge.send('snapshot', { app: 'Calculator' });
    try {
      await bridge.send('is', { state: 'nonexistent', ref: '@b1' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('box returns bounds array', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];
    function findButton(els: any[]): any {
      for (const el of els) {
        if (el.role === 'button') return el;
        if (el.children) { const f = findButton(el.children); if (f) return f; }
      }
    }
    const btn = findButton(els);

    const result = await bridge.send('box', { ref: btn.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.bounds).toBeDefined();
    const bounds = result.bounds as number[];
    expect(bounds.length).toBe(4);
    expect(bounds[2]).toBeGreaterThan(0); // width > 0
    expect(bounds[3]).toBeGreaterThan(0); // height > 0
  });

  test('children returns child list', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const els = snap.elements as any[];

    // Find a group element that has children
    function findGroup(els: any[]): any {
      for (const el of els) {
        if (el.role === 'group' && el.children && el.children.length > 0) return el;
        if (el.children) { const f = findGroup(el.children); if (f) return f; }
      }
    }
    const group = findGroup(els);
    if (!group) return;

    const result = await bridge.send('children', { ref: group.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    const children = result.children as any[];
    expect(children.length).toBeGreaterThan(0);
    expect(children[0]).toHaveProperty('role');
  });
});

describe('Wait', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('wait ms waits for duration', async () => {
    const start = Date.now();
    const result = await bridge.send('wait', { ms: 200 }) as Record<string, unknown>;
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(true);
    expect(result.waited_ms).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(150); // Some tolerance
  });

  test('wait --app for running app succeeds immediately', async () => {
    // Finder is always running
    const result = await bridge.send('wait', { app: 'Finder', timeout: 5000 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.app).toBe('Finder');
  });

  test('wait --app for nonexistent app times out', async () => {
    try {
      await bridge.send('wait', { app: 'NonexistentApp12345', timeout: 1000 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32003); // TIMEOUT
    }
  });

  test('wait without params returns error', async () => {
    try {
      await bridge.send('wait', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});
