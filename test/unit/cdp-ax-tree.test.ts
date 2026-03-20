import { describe, test, expect } from 'vitest';
import { CDPAXTree } from '../../src/cdp/ax-tree.js';

// Create a mock CDPConnection that returns canned AX tree data
function createMockConnection(nodes: any[]): any {
  return {
    send: async (method: string, params?: any) => {
      if (method === 'Accessibility.getFullAXTree') {
        return { nodes };
      }
      return {};
    },
  };
}

describe('CDP AX Tree', () => {
  test('basic tree walk produces elements with refs', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'RootWebArea' }, name: { type: 'computedString', value: 'Test Page' }, childIds: ['2', '3'], backendDOMNodeId: 1 },
      { nodeId: '2', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'Click Me' }, childIds: [], backendDOMNodeId: 2 },
      { nodeId: '3', ignored: false, role: { type: 'role', value: 'textbox' }, name: { type: 'computedString', value: 'Input' }, childIds: [], backendDOMNodeId: 3, value: { type: 'string', value: 'hello' } },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    // Root is a webarea, so its children are promoted to top level
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].role).toBe('button');
    expect(result.elements[0].label).toBe('Click Me');
    expect(result.elements[0].ref).toMatch(/^@b\d+$/);
    expect(result.elements[1].role).toBe('textfield');
    expect(result.elements[1].value).toBe('hello');
  });

  test('non-webarea root is kept as-is', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'group' }, name: { type: 'computedString', value: 'Root Group' }, childIds: ['2'], backendDOMNodeId: 1 },
      { nodeId: '2', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'OK' }, childIds: [], backendDOMNodeId: 2 },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].role).toBe('group');
    expect(result.elements[0].children).toHaveLength(1);
    expect(result.elements[0].children![0].role).toBe('button');
  });

  test('ignored nodes are skipped', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'RootWebArea' }, childIds: ['2', '3'], backendDOMNodeId: 1 },
      { nodeId: '2', ignored: true, role: { type: 'role', value: 'generic' }, childIds: [], backendDOMNodeId: 2 },
      { nodeId: '3', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'OK' }, childIds: [], backendDOMNodeId: 3 },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    const allElements = flattenElements(result.elements);
    // Root is webarea (promoted), ignored node skipped, so just the button
    expect(allElements.length).toBe(1);
    expect(allElements[0].role).toBe('button');
  });

  test('interactive filter only includes interactive elements', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'RootWebArea' }, childIds: ['2', '3', '4'], backendDOMNodeId: 1 },
      { nodeId: '2', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'Click' }, childIds: [], backendDOMNodeId: 2 },
      { nodeId: '3', ignored: false, role: { type: 'role', value: 'heading' }, name: { type: 'computedString', value: 'Title' }, childIds: [], backendDOMNodeId: 3 },
      { nodeId: '4', ignored: false, role: { type: 'role', value: 'link' }, name: { type: 'computedString', value: 'More' }, childIds: [], backendDOMNodeId: 4 },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({ interactive: true });

    const flat = flattenElements(result.elements);
    // Interactive mode should include button and link, but not heading (text role)
    expect(flat.some(e => e.role === 'button')).toBe(true);
    expect(flat.some(e => e.role === 'link')).toBe(true);
    expect(flat.some(e => e.role === 'text')).toBe(false);
  });

  test('refMap contains correct mappings', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'RootWebArea' }, childIds: ['2'], backendDOMNodeId: 10 },
      { nodeId: '2', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'OK' }, childIds: [], backendDOMNodeId: 20 },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    expect(result.refMap.size).toBeGreaterThan(0);
    // Find the button ref
    const flat = flattenElements(result.elements);
    const btn = flat.find(e => e.role === 'button');
    expect(btn).toBeDefined();

    const nodeRef = result.refMap.get(btn!.ref);
    expect(nodeRef).toBeDefined();
    expect(nodeRef!.nodeId).toBe('2');
    expect(nodeRef!.backendDOMNodeId).toBe(20);
  });

  test('element properties: disabled and focused', async () => {
    const nodes = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'RootWebArea' }, childIds: ['2', '3'], backendDOMNodeId: 1 },
      {
        nodeId: '2', ignored: false, role: { type: 'role', value: 'button' }, name: { type: 'computedString', value: 'Disabled' },
        childIds: [], backendDOMNodeId: 2,
        properties: [{ name: 'disabled', value: { type: 'boolean', value: true } }],
      },
      {
        nodeId: '3', ignored: false, role: { type: 'role', value: 'textbox' }, name: { type: 'computedString', value: 'Focused' },
        childIds: [], backendDOMNodeId: 3,
        properties: [{ name: 'focused', value: { type: 'boolean', value: true } }],
      },
    ];

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    const flat = flattenElements(result.elements);
    const disabledBtn = flat.find(e => e.label === 'Disabled');
    expect(disabledBtn!.enabled).toBe(false);

    const focusedInput = flat.find(e => e.label === 'Focused');
    expect(focusedInput!.focused).toBe(true);
  });

  test('MAX_DEPTH (50) is enforced locally', async () => {
    // Create deeply nested tree (60 levels)
    const nodes: any[] = [];
    for (let i = 0; i < 60; i++) {
      nodes.push({
        nodeId: String(i + 1),
        ignored: false,
        role: { type: 'role', value: 'group' },
        name: { type: 'computedString', value: `Level ${i}` },
        childIds: i < 59 ? [String(i + 2)] : [],
        backendDOMNodeId: i + 1,
      });
    }

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    // Local MAX_DEPTH is 50, so tree should be capped
    let maxDepth = 0;
    function measureDepth(els: any[], d: number) {
      for (const el of els) {
        maxDepth = Math.max(maxDepth, d);
        if (el.children) measureDepth(el.children, d + 1);
      }
    }
    measureDepth(result.elements, 1);
    // MAX_DEPTH=50 check is `currentDepth > 50`, so depth 50 still builds
    // Measurement starts at 1, so max measured depth = 51
    expect(maxDepth).toBeLessThanOrEqual(51);
    // But it shouldn't be all 60 levels
    expect(maxDepth).toBeLessThan(60);
  });

  test('MAX_ELEMENTS (500) is enforced', async () => {
    // Create a wide tree with 600 children
    const childIds = Array.from({ length: 600 }, (_, i) => String(i + 2));
    const nodes: any[] = [
      { nodeId: '1', ignored: false, role: { type: 'role', value: 'group' }, childIds, backendDOMNodeId: 1 },
    ];
    for (let i = 0; i < 600; i++) {
      nodes.push({
        nodeId: String(i + 2),
        ignored: false,
        role: { type: 'role', value: 'button' },
        name: { type: 'computedString', value: `Button ${i}` },
        childIds: [],
        backendDOMNodeId: i + 2,
      });
    }

    const tree = new CDPAXTree(createMockConnection(nodes));
    const result = await tree.getTree({});

    const flat = flattenElements(result.elements);
    expect(flat.length).toBeLessThanOrEqual(500);
  });

  test('empty node list returns empty elements', async () => {
    const tree = new CDPAXTree(createMockConnection([]));
    const result = await tree.getTree({});
    expect(result.elements).toHaveLength(0);
    expect(result.refMap.size).toBe(0);
  });
});

function flattenElements(elements: any[]): any[] {
  const result: any[] = [];
  function walk(els: any[]) {
    for (const el of els) {
      result.push(el);
      if (el.children) walk(el.children);
    }
  }
  walk(elements);
  return result;
}
