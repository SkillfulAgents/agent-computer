import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Real App — Calculator', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'Calculator', wait: true });
    await sleep(2000);
    await bridge.send('switch', { name: 'Calculator' });
    await sleep(500);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('snapshot shows calculator buttons', async () => {
    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as any;
    expect(snap.elements.length).toBeGreaterThan(0);

    function findButton(els: any[], label: string): any {
      for (const el of els) {
        if (el.role === 'button' && el.label === label) return el;
        if (el.children) { const f = findButton(el.children, label); if (f) return f; }
      }
    }

    // Should have number buttons (labels may be localized)
    expect(findButton(snap.elements, '1')).toBeDefined();
    expect(findButton(snap.elements, '2')).toBeDefined();
    // + and = may have labels like "add" and "equals"
    const plusBtn = findButton(snap.elements, '+') ?? findButton(snap.elements, 'Add');
    const eqBtn = findButton(snap.elements, '=') ?? findButton(snap.elements, 'Equals');
    expect(plusBtn).toBeDefined();
    expect(eqBtn).toBeDefined();
  });

  test('7 + 3 = 10', async () => {
    // Clear calculator first
    await bridge.send('key', { combo: 'cmd+e' }); // Clear all
    await sleep(300);

    const snap = await bridge.send('snapshot', { app: 'Calculator', interactive: true }) as any;

    function findButton(els: any[], label: string): any {
      for (const el of els) {
        if (el.role === 'button' && el.label === label) return el;
        if (el.children) { const f = findButton(el.children, label); if (f) return f; }
      }
    }

    const btn7 = findButton(snap.elements, '7');
    const btnPlus = findButton(snap.elements, '+') ?? findButton(snap.elements, 'Add');
    const btn3 = findButton(snap.elements, '3');
    const btnEq = findButton(snap.elements, '=') ?? findButton(snap.elements, 'Equals');

    expect(btn7).toBeDefined();
    expect(btnPlus).toBeDefined();
    expect(btn3).toBeDefined();
    expect(btnEq).toBeDefined();

    await bridge.send('click', { ref: btn7.ref });
    await sleep(200);
    await bridge.send('click', { ref: btnPlus.ref });
    await sleep(200);
    await bridge.send('click', { ref: btn3.ref });
    await sleep(200);
    await bridge.send('click', { ref: btnEq.ref });
    await sleep(500);

    // Read the display — Calculator uses scrollarea "Input" with a child text value
    const snap2 = await bridge.send('snapshot', { app: 'Calculator' }) as any;

    function findInputValue(els: any[]): string | null {
      for (const el of els) {
        if (el.label === 'Input' && el.children) {
          for (const child of el.children) {
            if (child.value && typeof child.value === 'string') {
              return child.value.replace(/[^\d.]/g, '');
            }
          }
        }
        if (el.children) { const f = findInputValue(el.children); if (f !== null) return f; }
      }
      return null;
    }

    const display = findInputValue(snap2.elements);
    expect(display).toBe('10');
  });

  test('find buttons by role', async () => {
    const result = await bridge.send('find', { role: 'button', app: 'Calculator' }) as any;
    expect(result.ok).toBe(true);
    expect(result.elements.length).toBeGreaterThan(10); // Calculator has many buttons
  });
});
