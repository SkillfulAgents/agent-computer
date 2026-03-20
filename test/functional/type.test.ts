import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, clearTestAppStatus, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Type & Fill', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
    // Navigate to Text Input tab
    await sleep(500);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  function findByIdentifier(els: any[], id: string): any {
    for (const el of els) {
      if (el.label === id || (el.value && String(el.value).includes(id))) return el;
      if (el.children) { const f = findByIdentifier(el.children, id); if (f) return f; }
    }
  }

  function findTextField(els: any[], placeholder?: string): any {
    for (const el of els) {
      if (el.role === 'textfield' && (!placeholder || el.label?.includes(placeholder) || el.value?.includes(placeholder))) return el;
      if (el.children) { const f = findTextField(el.children, placeholder); if (f) return f; }
    }
  }

  test('fill sets text in a text field', async () => {
    // Click on "Text Input" tab first
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;

    function findTab(els: any[], label: string): any {
      for (const el of els) {
        if (el.role === 'radio' && el.label?.includes(label)) return el;
        if (el.label?.includes(label) && (el.role === 'button' || el.role === 'tab')) return el;
        if (el.children) { const f = findTab(el.children, label); if (f) return f; }
      }
    }

    // Try to find and click the Text Input tab
    const textTab = findTab(snap.elements, 'Text Input');
    if (textTab) {
      await bridge.send('click', { ref: textTab.ref });
      await sleep(500);
    }

    // Find a text field
    const snap2 = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;
    const nameField = findTextField(snap2.elements, 'name');

    if (nameField) {
      await bridge.send('fill', { ref: nameField.ref, text: 'Test User' });
      await sleep(500);

      // Read back the value
      const result = await bridge.send('read', { ref: nameField.ref }) as any;
      expect(result.value).toBe('Test User');
    }
  });

  test('fill replaces existing text', async () => {
    const snap = await bridge.send('snapshot', { app: TEST_APP_NAME, interactive: true }) as any;
    const nameField = findTextField(snap.elements, 'name') ?? findTextField(snap.elements);

    if (nameField) {
      await bridge.send('fill', { ref: nameField.ref, text: 'First Value' });
      await sleep(300);
      await bridge.send('fill', { ref: nameField.ref, text: 'Replaced Value' });
      await sleep(300);

      const result = await bridge.send('read', { ref: nameField.ref }) as any;
      expect(result.value).toBe('Replaced Value');
    }
  });
});
