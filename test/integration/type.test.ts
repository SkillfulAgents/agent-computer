import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Type & Fill — TextEdit', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    // TextEdit may open a file browser — create new document with Cmd+N
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1500);
  }, 30000);

  afterAll(async () => {
    // Close without saving — Cmd+W, then click "Don't Save" or dismiss
    try {
      await bridge.send('key', { combo: 'cmd+z', repeat: 20 }); // undo all
      await sleep(200);
      await bridge.send('quit', { name: 'TextEdit' });
    } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('type returns correct response', async () => {
    // Type sends CGEvent keystrokes to the frontmost app.
    // Actual text insertion depends on which app is frontmost (environment-dependent).
    // We verify the command contract; text insertion is verified by fill and paste tests.
    const result = await bridge.send('type', { text: 'Hello AC' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.length).toBe(8);
  });

  test('type with delay returns correct response', async () => {
    const result = await bridge.send('type', { text: 'abc', delay: 50 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.length).toBe(3);
  });

  test('fill replaces text in element', { timeout: 30000 }, async () => {
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];

    function findTextArea(els: any[]): any {
      // Prefer textarea (content area) over textfield (title bar, etc.)
      function find(els: any[], role: string): any {
        for (const el of els) {
          if (el.role === role) return el;
          if (el.children) {
            const found = find(el.children, role);
            if (found) return found;
          }
        }
      }
      return find(els, 'textarea') || find(els, 'textfield');
    }

    const textArea = findTextArea(elements);
    expect(textArea).toBeDefined();

    const result = await bridge.send('fill', { ref: textArea.ref, text: 'Replaced text' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.ref).toBe(textArea.ref);
    await sleep(300);

    // Verify replacement
    const snap2 = await bridge.send('snapshot', { app: 'TextEdit' }) as Record<string, unknown>;
    const textArea2 = findTextArea(snap2.elements as any[]);
    expect(textArea2.value).toContain('Replaced text');
  });

  test('fill nonexistent ref returns error', async () => {
    await bridge.send('snapshot', { app: 'TextEdit', interactive: true });
    try {
      await bridge.send('fill', { ref: '@t999', text: 'test' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });

  test('type without text returns error', async () => {
    try {
      await bridge.send('type', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('fill without ref returns error', async () => {
    try {
      await bridge.send('fill', { text: 'test' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Key Combos', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    // Calculator for safe key testing
    try { await bridge.send('launch', { name: 'Calculator', wait: true }); } catch { /* ok */ }
    await sleep(1000);
  }, 30000);

  afterAll(async () => {
    try { await bridge.send('quit', { name: 'Calculator' }); } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('key sends a key combo', async () => {
    const result = await bridge.send('key', { combo: 'escape' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.combo).toBe('escape');
    expect(result.count).toBe(1);
  });

  test('key with repeat', async () => {
    const result = await bridge.send('key', { combo: 'tab', repeat: 3 }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
  });

  test('key combo with modifier', async () => {
    // Cmd+A (select all) — safe to press in Calculator
    const result = await bridge.send('key', { combo: 'cmd+a' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
  });

  test('key missing combo returns error', async () => {
    try {
      await bridge.send('key', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('keydown and keyup work', async () => {
    const downResult = await bridge.send('keydown', { key: 'shift' }) as Record<string, unknown>;
    expect(downResult.ok).toBe(true);
    expect(downResult.action).toBe('down');

    await sleep(50);

    const upResult = await bridge.send('keyup', { key: 'shift' }) as Record<string, unknown>;
    expect(upResult.ok).toBe(true);
    expect(upResult.action).toBe('up');
  });

  test('keydown unknown key returns error', async () => {
    try {
      await bridge.send('keydown', { key: 'nonexistentkey' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('keydown missing key returns error', async () => {
    try {
      await bridge.send('keydown', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Clipboard', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('clipboard set and read roundtrip', async () => {
    const testText = 'AC clipboard test ' + Date.now();

    const setResult = await bridge.send('clipboard_set', { text: testText }) as Record<string, unknown>;
    expect(setResult.ok).toBe(true);

    await sleep(100);

    const readResult = await bridge.send('clipboard_read') as Record<string, unknown>;
    expect(readResult.ok).toBe(true);
    expect(readResult.text).toBe(testText);
  });

  test('clipboard read returns current content', async () => {
    const result = await bridge.send('clipboard_read') as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('text');
  });

  test('clipboard set without text returns error', async () => {
    try {
      await bridge.send('clipboard_set', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});

describe('Paste', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    try { await bridge.send('quit', { name: 'TextEdit' }); } catch { /* ok */ }
    await sleep(1000);
    await bridge.send('launch', { name: 'TextEdit', wait: true });
    await sleep(2000);
    // TextEdit may open a file browser — create new document
    await bridge.send('key', { combo: 'cmd+n' });
    await sleep(1500);
  }, 30000);

  afterAll(async () => {
    try {
      await bridge.send('key', { combo: 'cmd+z', repeat: 20 });
      await sleep(200);
      await bridge.send('quit', { name: 'TextEdit' });
    } catch { /* ok */ }
    await bridge.disconnect();
    await sleep(500);
  });

  test('paste inserts text via clipboard', { timeout: 30000 }, async () => {
    // Focus TextEdit textarea
    const snap = await bridge.send('snapshot', { app: 'TextEdit', interactive: true }) as Record<string, unknown>;
    const elements = snap.elements as any[];

    function findTextArea(els: any[]): any {
      // Prefer textarea (content area) over textfield (title bar, etc.)
      function find(els: any[], role: string): any {
        for (const el of els) {
          if (el.role === role) return el;
          if (el.children) {
            const found = find(el.children, role);
            if (found) return found;
          }
        }
      }
      return find(els, 'textarea') || find(els, 'textfield');
    }

    const textArea = findTextArea(elements);
    expect(textArea).toBeDefined();

    // Fill first to clear, then paste
    await bridge.send('fill', { ref: textArea.ref, text: '' });
    await sleep(200);

    // Click to ensure focus
    await bridge.send('click', { ref: textArea.ref });
    await sleep(200);

    const result = await bridge.send('paste', { text: 'Pasted content!' }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.length).toBe(15);
    await sleep(300);

    // Verify
    const snap2 = await bridge.send('snapshot', { app: 'TextEdit' }) as Record<string, unknown>;
    const textArea2 = findTextArea(snap2.elements as any[]);
    expect(textArea2.value).toContain('Pasted content!');
  });

  test('paste without text returns error', async () => {
    try {
      await bridge.send('paste', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });
});
