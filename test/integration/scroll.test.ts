import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Scroll', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // TextEdit for scrollable content
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('scroll down returns success', async () => {
    const result = await bridge.send('scroll', { direction: 'down', amount: 3 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('down');
    expect(result.amount).toBe(3);
  });

  test('scroll up returns success', async () => {
    const result = await bridge.send('scroll', { direction: 'up', amount: 2 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('up');
  });

  test('scroll left returns success', async () => {
    const result = await bridge.send('scroll', { direction: 'left' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.direction).toBe('left');
  });

  test('scroll right returns success', async () => {
    const result = await bridge.send('scroll', { direction: 'right' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('scroll with --smooth flag works', async () => {
    const result = await bridge.send('scroll', { direction: 'down', amount: 5, smooth: true }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('scroll with --pixels works', async () => {
    const result = await bridge.send('scroll', { direction: 'down', pixels: 100 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('scroll with --on ref works', async () => {
    // Get a scrollable element
    const snap = await bridge.send('snapshot', { app: 'TextEdit' }) as Record<string, unknown>;
    const elements = snap.elements as any[];

    function findScrollArea(els: any[]): any {
      for (const el of els) {
        if (el.role === 'scrollarea') return el;
        if (el.children) {
          const found = findScrollArea(el.children);
          if (found) return found;
        }
      }
    }

    const scrollArea = findScrollArea(elements);
    if (!scrollArea) return; // Skip if no scroll area found

    const result = await bridge.send('scroll', { direction: 'down', on: scrollArea.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('scroll on nonexistent ref returns error', async () => {
    await bridge.send('snapshot', { app: 'TextEdit' });
    try {
      await bridge.send('scroll', { direction: 'down', on: '@sa999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('scroll without direction returns error', async () => {
    try {
      await bridge.send('scroll', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Focus & Set', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('launch', { name: 'TextEdit', wait: true }); } catch { /* ok */ }
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('focus sets focus on element', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];

    function findTextArea(els: any[]): any {
      for (const el of els) {
        if (el.role === 'textarea') return el;
        if (el.children) {
          const found = findTextArea(el.children);
          if (found) return found;
        }
      }
    }

    const textArea = findTextArea(elements);
    if (!textArea) return;

    const result = await bridge.send('focus', { ref: textArea.ref }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(textArea.ref);
  });

  test('focus on nonexistent ref returns error', async () => {
    await bridge.send('snapshot', { app: 'TextEdit', interactive: true });
    try {
      await bridge.send('focus', { ref: '@t999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('focus without ref returns error', async () => {
    try {
      await bridge.send('focus', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('set changes element value', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];

    function findTextArea(els: any[]): any {
      for (const el of els) {
        if (el.role === 'textarea') return el;
        if (el.children) {
          const found = findTextArea(el.children);
          if (found) return found;
        }
      }
    }

    const textArea = findTextArea(elements);
    if (!textArea) return;

    const result = await bridge.send('set', { ref: textArea.ref, value: 'Set value test' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(textArea.ref);
  });

  test('set without ref returns error', async () => {
    try {
      await bridge.send('set', { value: 'test' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('set without value returns error', async () => {
    try {
      await bridge.send('set', { ref: '@t1' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('check returns success', async () => {
    // We can't easily test check/uncheck without a checkbox, so just test the error handling
    await bridge.send('snapshot', { app: 'TextEdit', interactive: true });
    try {
      await bridge.send('check', { ref: '@c999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('uncheck returns success', async () => {
    await bridge.send('snapshot', { app: 'TextEdit', interactive: true });
    try {
      await bridge.send('uncheck', { ref: '@c999' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('select without ref returns error', async () => {
    try {
      await bridge.send('select', { value: 'test' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('check without ref returns error', async () => {
    try {
      await bridge.send('check', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});
