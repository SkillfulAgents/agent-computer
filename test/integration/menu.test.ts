import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Menu — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    // Activate TextEdit and create new document
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(500);
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1500);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('menu list returns top-level menus', async () => {
    const result = await bridge.send('menu_list', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    const items = result.items as any[];
    expect(items.length).toBeGreaterThan(3);

    // TextEdit should have standard menus
    const titles = items.map((i: any) => i.title);
    expect(titles).toContain('File');
    expect(titles).toContain('Edit');
  });

  test('menu list with menu name shows items under that menu', async () => {
    const result = await bridge.send('menu_list', { menu: 'Edit', app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.menu).toBe('Edit');
    const items = result.items as any[];
    expect(items.length).toBeGreaterThan(0);

    // Edit menu should have common items
    const titles = items.map((i: any) => i.title);
    expect(titles).toContain('Select All');
  });

  test('menu list nonexistent menu returns error', async () => {
    try {
      await bridge.send('menu_list', { menu: 'NonexistentMenu', app: 'TextEdit' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('menu click works', { timeout: 15000 }, async () => {
    // First type some text to have something to select
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];

    function findTextArea(els: any[]): any {
      for (const el of els) {
        if (el.role === 'textarea') return el;
        if (el.children) { const f = findTextArea(el.children); if (f) return f; }
      }
    }

    const textArea = findTextArea(els);
    if (textArea) {
      await bridge.send('fill', { ref: textArea.ref, text: 'Menu test text' });
      await sleep(300);
    }

    // Click Edit > Select All
    const result = await bridge.send('menu_click', { path: 'Edit > Select All', app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.path).toBe('Edit > Select All');
    await sleep(300);
  });

  test('menu click invalid path returns error', async () => {
    try {
      await bridge.send('menu_click', { path: 'Nonexistent > Item', app: 'TextEdit' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('menu click missing path returns error', async () => {
    try {
      await bridge.send('menu_click', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Menu Bar Extras', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('menubar returns extras list', async () => {
    const result = await bridge.send('menubar') as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('extras');
    const extras = result.extras as any[];
    expect(Array.isArray(extras)).toBe(true);
    // There should be at least some menu bar extras (Clock, Wi-Fi, etc.)
  });
});
