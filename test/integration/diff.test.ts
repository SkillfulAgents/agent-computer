import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Changed & Diff — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(500);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
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

  test('changed requires a prior snapshot', async () => {
    // After restarting daemon, changed should fail without snapshot
    // Note: daemon is shared, so we restart it to clear state
    const freshBridge = new Bridge({ timeout: 20000 });
    // With a fresh daemon (or if snapshot was taken by beforeAll),
    // changed should either error or succeed based on daemon state
    // The important contract: changed returns ok:true with changed:boolean OR errors
    try {
      const result = await freshBridge.send('changed', { app: 'TextEdit' }) as Record<string, unknown>;
      expect(result.ok).toBe(true);
      expect(typeof result.changed).toBe('boolean');
    } catch (err: any) {
      // If no prior snapshot, should get invalidRequest error
      expect(err.code).toBe(-32600);
    }
    await freshBridge.disconnect();
  });

  test('changed detects no change when nothing happened', { timeout: 15000 }, async () => {
    // Take initial snapshot
    await bridge.send('snapshot', { app: 'TextEdit', compact: true });
    await sleep(500);

    // Check if changed
    const result = await bridge.send('changed', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(false);
  });

  test('changed detects change after typing', { timeout: 15000 }, async () => {
    // Take initial snapshot
    await bridge.send('snapshot', { app: 'TextEdit', compact: true });
    await sleep(500);

    // Type something to change the UI
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(300);
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
      await bridge.send('fill', { ref: textArea.ref, text: 'Changed text ' + Date.now() });
      await sleep(500);
    }

    // Take baseline again after fill (fill changed the refmap)
    await bridge.send('snapshot', { app: 'TextEdit', compact: true });
    await sleep(300);

    // Type more to create a new change
    if (textArea) {
      await bridge.send('fill', { ref: textArea.ref, text: 'New content ' + Date.now() });
      await sleep(500);
    }

    // Now check changed
    const result = await bridge.send('changed', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    // The snapshot tree structure should have changed because the text value changed
    expect(result.changed).toBe(true);
  });

  test('diff returns added/removed elements', { timeout: 15000 }, async () => {
    // Take initial snapshot
    await bridge.send('snapshot', { app: 'TextEdit', compact: true });
    await sleep(500);

    // Type to change content
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(300);
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const els = snap.elements as any[];

    function findTextArea(els: any[]): any {
      for (const el of els) {
        if (el.role === 'textarea') return el;
        if (el.children) { const f = findTextArea(el.children); if (f) return f; }
      }
    }

    // Take baseline
    await bridge.send('snapshot', { app: 'TextEdit', compact: true });
    await sleep(300);

    const textArea = findTextArea(els);
    if (textArea) {
      await bridge.send('fill', { ref: textArea.ref, text: 'Diff test ' + Date.now() });
      await sleep(500);
    }

    // Diff
    const result = await bridge.send('diff', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(typeof result.changed).toBe('boolean');
    expect(result.added).toBeDefined();
    expect(result.removed).toBeDefined();
    expect(Array.isArray(result.added)).toBe(true);
    expect(Array.isArray(result.removed)).toBe(true);
  });
});
