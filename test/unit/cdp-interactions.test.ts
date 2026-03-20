import { describe, test, expect } from 'vitest';
import { CDPInteractions } from '../../src/cdp/interactions.js';

// Track all CDP commands sent
function createMockConnection(): { connection: any; commands: Array<{ method: string; params: any }> } {
  const commands: Array<{ method: string; params: any }> = [];
  const connection = {
    send: async (method: string, params?: any) => {
      commands.push({ method, params: params ?? {} });
      // Return mock data for resolveNode
      if (method === 'DOM.resolveNode') {
        return { object: { objectId: 'obj-1' } };
      }
      if (method === 'Runtime.callFunctionOn') {
        return { result: { value: false } };
      }
      return {};
    },
  };
  return { connection, commands };
}

describe('CDP Interactions', () => {
  test('click sends mousePressed and mouseReleased at element center', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.click(123, [100, 200, 50, 30]);

    const pressed = commands.find(c => c.method === 'Input.dispatchMouseEvent' && c.params.type === 'mousePressed');
    const released = commands.find(c => c.method === 'Input.dispatchMouseEvent' && c.params.type === 'mouseReleased');

    expect(pressed).toBeDefined();
    expect(pressed!.params.x).toBe(125); // 100 + 50/2
    expect(pressed!.params.y).toBe(215); // 200 + 30/2
    expect(pressed!.params.button).toBe('left');

    expect(released).toBeDefined();
    expect(released!.params.x).toBe(125);
    expect(released!.params.y).toBe(215);
  });

  test('right-click sends right button', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.click(123, [0, 0, 100, 100], { right: true });

    const pressed = commands.find(c => c.params.type === 'mousePressed');
    expect(pressed!.params.button).toBe('right');
  });

  test('double-click sends two click sequences', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.click(123, [0, 0, 100, 100], { double: true });

    const pressed = commands.filter(c => c.params.type === 'mousePressed');
    const released = commands.filter(c => c.params.type === 'mouseReleased');
    expect(pressed).toHaveLength(2);
    expect(released).toHaveLength(2);
  });

  test('key combo parsing for cmd+a', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.key('cmd+a');

    // Should have modifier keyDown, main keyDown, main keyUp, modifier keyUp
    const keyEvents = commands.filter(c => c.method === 'Input.dispatchKeyEvent');
    expect(keyEvents.length).toBeGreaterThanOrEqual(4);

    // Check that Meta modifier was pressed
    const metaDown = keyEvents.find(c => c.params.key === 'Meta' && c.params.type === 'rawKeyDown');
    expect(metaDown).toBeDefined();
  });

  test('scroll sends mouseWheel event', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.scroll('down', 2);

    const wheel = commands.find(c => c.params.type === 'mouseWheel');
    expect(wheel).toBeDefined();
    expect(wheel!.params.deltaY).toBe(200); // 2 * 100
    expect(wheel!.params.deltaX).toBe(0);
  });

  test('scroll up sends negative deltaY', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.scroll('up', 1);

    const wheel = commands.find(c => c.params.type === 'mouseWheel');
    expect(wheel!.params.deltaY).toBe(-100);
  });

  test('focus sends DOM.focus', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.focus(456);

    const focus = commands.find(c => c.method === 'DOM.focus');
    expect(focus).toBeDefined();
    expect(focus!.params.backendNodeId).toBe(456);
  });

  test('type sends Input.insertText', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.type('Hello World');

    const insert = commands.find(c => c.method === 'Input.insertText');
    expect(insert).toBeDefined();
    expect(insert!.params.text).toBe('Hello World');
  });

  test('fill focuses, selects all, then types', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.fill(789, 'New Text');

    // Should have: focus, key events for cmd+a, insertText
    const focus = commands.find(c => c.method === 'DOM.focus');
    expect(focus).toBeDefined();

    const insert = commands.find(c => c.method === 'Input.insertText');
    expect(insert).toBeDefined();
    expect(insert!.params.text).toBe('New Text');

    // Focus should come before insert
    const focusIdx = commands.findIndex(c => c.method === 'DOM.focus');
    const insertIdx = commands.findIndex(c => c.method === 'Input.insertText');
    expect(focusIdx).toBeLessThan(insertIdx);
  });

  test('select calls Runtime.callFunctionOn', async () => {
    const { connection, commands } = createMockConnection();
    const interactions = new CDPInteractions(connection);

    await interactions.select(123, 'Blue');

    const resolve = commands.find(c => c.method === 'DOM.resolveNode');
    expect(resolve).toBeDefined();

    const callFn = commands.find(c => c.method === 'Runtime.callFunctionOn');
    expect(callFn).toBeDefined();
    expect(callFn!.params.arguments[0].value).toBe('Blue');
  });
});
