import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Dialog — Detection', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // Force-quit TextEdit to clear any lingering state
    try { await bridge.send('quit', { name: 'TextEdit', force: true }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(500);
    // Dismiss any initial dialogs/sheets
    await bridge.send('key', { combo: 'escape' });
    await sleep(500);
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1500);
  }, 30000);

  afterAll(async () => {
    // Clean up: dismiss any dialogs, then force-quit
    try { await bridge.send('key', { combo: 'escape' }); } catch { /* ok */ }
    await sleep(300);
    try { await bridge.send('quit', { name: 'TextEdit', force: true }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('dialog detect returns ok when no dialog', async () => {
    const result = await bridge.send('dialog', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.found).toBe(false);
  });

  test('dialog detect and cancel save dialog', { timeout: 20000 }, async () => {
    // Type some text so there's content to save
    await bridge.send('switch', { name: 'TextEdit' });
    await sleep(300);

    // Get snapshot to find textarea
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
      await bridge.send('fill', { ref: textArea.ref, text: 'Dialog test content' });
      await sleep(300);
    }

    // Trigger save dialog
    await bridge.send('key', { combo: 'cmd+s' });
    await sleep(1500);

    // Detect the dialog
    const result = await bridge.send('dialog', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.dialog).toBeDefined();

    const dialog = result.dialog as Record<string, unknown>;
    expect(dialog.type).toBeDefined();
    expect(dialog.buttons).toBeDefined();

    // Cancel via RPC (not escape key)
    const cancelResult = await bridge.send('dialog_cancel', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(cancelResult.ok).toBe(true);
    await sleep(1000);

    // Verify dialog is gone
    const check = await bridge.send('dialog', { app: 'TextEdit' }) as Record<string, unknown>;
    expect(check.found).toBe(false);
  });
});

describe('Dialog — File Dialog', () => {
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
    try { await bridge.send('key', { combo: 'escape' }); } catch { /* ok */ }
    await sleep(300);
    // Don't save on quit
    try {
      await bridge.send('quit', { name: 'TextEdit' });
    } catch { /* ok */ }
    await sleep(500);
    // If there's a "don't save" dialog, dismiss it
    try { await bridge.send('key', { combo: 'cmd+delete' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('dialog file sets filename in save dialog', { timeout: 20000 }, async () => {
    // Type content
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
      await bridge.send('fill', { ref: textArea.ref, text: 'File dialog test' });
      await sleep(300);
    }

    // Open save dialog
    await bridge.send('key', { combo: 'cmd+s' });
    await sleep(1500);

    // Set the filename
    const result = await bridge.send('dialog_file', {
      path: 'ac-test-dialog-file',
      app: 'TextEdit'
    }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.path).toBe('ac-test-dialog-file');

    // Cancel instead of actually saving
    await bridge.send('key', { combo: 'escape' });
    await sleep(500);
  });
});
