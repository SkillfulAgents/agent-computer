import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Real App — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit', force: true }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(500);
    await bridge.send('key', { combo: 'escape' });
    await sleep(500);
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1500);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit', force: true }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  function findTextArea(els: any[]): any {
    for (const el of els) {
      if (el.role === 'textarea') return el;
      if (el.children) { const f = findTextArea(el.children); if (f) return f; }
    }
  }

  test('snapshot shows TextEdit with textarea', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as any;
    const ta = findTextArea(snap.elements);
    expect(ta).toBeDefined();
    expect(ta.role).toBe('textarea');
  });

  test('fill + read roundtrip', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as any;
    const ta = findTextArea(snap.elements);
    expect(ta).toBeDefined();

    await bridge.send('fill', { ref: ta.ref, text: 'Hello from functional test!' });
    await sleep(500);

    const result = await bridge.send('read', { ref: ta.ref }) as any;
    expect(result.value).toContain('Hello from functional test');
  });

  test('select all via menu', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as any;
    const ta = findTextArea(snap.elements);
    if (ta) {
      await bridge.send('fill', { ref: ta.ref, text: 'Select all test text' });
      await sleep(300);
    }

    const result = await bridge.send('menu_click', { path: 'Edit > Select All', app: 'TextEdit' }) as any;
    expect(result.ok).toBe(true);
    await sleep(300);
  });

  test('menu list returns standard menus', async () => {
    const result = await bridge.send('menu_list', { app: 'TextEdit' }) as any;
    expect(result.ok).toBe(true);
    const titles = (result.items as any[]).map(i => i.title);
    expect(titles).toContain('File');
    expect(titles).toContain('Edit');
    expect(titles).toContain('Format');
  });

  test('clipboard copy and read', async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as any;
    const ta = findTextArea(snap.elements);
    if (ta) {
      await bridge.send('fill', { ref: ta.ref, text: 'Clipboard test content' });
      await sleep(300);
    }

    await bridge.send('key', { combo: 'cmd+a' });
    await sleep(200);
    await bridge.send('key', { combo: 'cmd+c' });
    await sleep(200);

    const clip = await bridge.send('clipboard_read') as any;
    expect(clip.text).toContain('Clipboard test content');
  });
});
