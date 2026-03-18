import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tree search helpers
function findByRole(els: any[], role: string): any {
  for (const el of els) {
    if (el.role === role && el.label) return el;
    if (el.children) {
      const found = findByRole(el.children, role);
      if (found) return found;
    }
  }
}

function findByLabel(els: any[], label: string): any {
  for (const el of els) {
    if (el.role === 'button' && el.label === label) return el;
    if (el.children) {
      const found = findByLabel(el.children, label);
      if (found) return found;
    }
  }
}

describe('Click — Basic', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
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

  test('click by ref works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];
    const btn = findByRole(elements, 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('click', { ref: btn.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(btn.ref);
    expect(result.bounds).toBeDefined();
    expect((result.bounds as number[]).length).toBe(4);
  });

  test('click by coordinates works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];
    const btn = findByLabel(elements, '0');
    expect(btn).toBeDefined();

    const [bx, by, bw, bh] = btn.bounds;
    const x = bx + bw / 2;
    const y = by + bh / 2;

    const result = await bridge.send('click', { x, y }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBeUndefined();
  });

  test('click with --right flag works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];
    const btn = findByRole(elements, 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('click', { ref: btn.ref, right: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);

    // Dismiss context menu
    await sleep(200);
    await bridge.send('click', { x: 1, y: 1 });
    await sleep(200);
  });

  test('click with --double flag works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const btn = findByRole(snap.elements as any[], 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('click', { ref: btn.ref, double: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('click nonexistent ref returns ELEMENT_NOT_FOUND', async () => {
    await bridge.send('snapshot', { app: 'Calculator', interactive: true });
    try {
      await bridge.send('click', { ref: '@b999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('click without ref or coords returns error', async () => {
    try {
      await bridge.send('click', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('click with modifiers works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const btn = findByRole(snap.elements as any[], 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('click', { ref: btn.ref, modifiers: ['shift'] }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('click with count works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const btn = findByRole(snap.elements as any[], 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('click', { ref: btn.ref, count: 3 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });
});

describe('Click — Hover & Mouse', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // Ensure Calculator is running (from previous describe)
    try {
      await bridge.send('launch', { name: 'Calculator', wait: true });
    } catch { /* may already be running */ }
    await sleep(500);
  }, 30000);

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('hover by ref works', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
    const btn = findByRole(snap.elements as any[], 'button');
    expect(btn).toBeDefined();

    const result = await bridge.send('hover', { ref: btn.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(btn.ref);
  });

  test('hover by coordinates works', async () => {
    const result = await bridge.send('hover', { x: 100, y: 100 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('hover nonexistent ref returns error', async () => {
    await bridge.send('snapshot', { app: 'Calculator', interactive: true });
    try {
      await bridge.send('hover', { ref: '@b999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('mouse down/up works', async () => {
    const downResult = await bridge.send('mouse', { action: 'down', button: 'left' }) as Record<string, unknown>;
    expect(downResult.ok).toBe(true);
    expect(downResult.action).toBe('down');
    expect(downResult.button).toBe('left');

    await sleep(50);

    const upResult = await bridge.send('mouse', { action: 'up', button: 'left' }) as Record<string, unknown>;
    expect(upResult.ok).toBe(true);
    expect(upResult.action).toBe('up');
  });

  test('mouse with invalid action returns error', async () => {
    try {
      await bridge.send('mouse', { action: 'invalid' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('mouse with invalid button returns error', async () => {
    try {
      await bridge.send('mouse', { action: 'down', button: 'invalid' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Click — Calculator Arithmetic (2+3=5)', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // Fresh Calculator launch for clean state
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'Calculator', wait: true });
    await sleep(2000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('2 + 3 = 5', { timeout: 45000 }, async () => {
    // Helper: snapshot and click a button by label
    async function clickButton(label: string) {
      const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as Record<string, unknown>;
      const els = snap.elements as any[];
      const btn = findByLabel(els, label);
      expect(btn).toBeDefined();
      await bridge.send('click', { ref: btn.ref });
      await sleep(300);
    }

    // Click: All Clear, 2, Add, 3, Equals
    await clickButton('All Clear');
    await clickButton('2');
    await clickButton('Add');
    await clickButton('3');
    await clickButton('Equals');
    await sleep(500);

    // Read the result
    const resultSnap = await bridge.send('snapshot', { app: 'Calculator' }) as Record<string, unknown>;
    const resultElements = resultSnap.elements as any[];

    // Find the Input display value — scrollarea labeled "Input" contains text with the answer
    function findInputValue(els: any[]): string | null {
      for (const el of els) {
        if (el.label === 'Input' && el.children) {
          for (const child of el.children) {
            if (child.value && typeof child.value === 'string') {
              // Strip invisible Unicode characters (LTR marks, etc.)
              return child.value.replace(/[^\d.]/g, '');
            }
          }
        }
        if (el.children) {
          const found = findInputValue(el.children);
          if (found !== null) return found;
        }
      }
      return null;
    }

    const displayValue = findInputValue(resultElements);
    expect(displayValue).toBe('5');
  });
});
