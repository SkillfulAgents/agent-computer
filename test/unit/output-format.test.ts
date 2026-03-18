import { describe, test, expect } from 'vitest';
import { formatOutput, wrapBoundary, truncateOutput } from '../../src/cli/output.js';

describe('Output Formatting — Text Mode', () => {
  test('snapshot formats as tree', () => {
    const data = {
      snapshot_id: 'snap-123',
      elements: [
        { ref: '@b1', role: 'button', label: 'OK', value: null, enabled: true, focused: false, bounds: [10, 20, 100, 30] },
        { ref: '@t1', role: 'textfield', label: 'Name', value: 'hello', enabled: true, focused: true, bounds: [10, 60, 200, 25] },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('[@b1]');
    expect(out).toContain('Button');
    expect(out).toContain('"OK"');
    expect(out).toContain('[@t1]');
    expect(out).toContain('Textfield');
    expect(out).toContain('value="hello"');
  });

  test('windows list formats as lines', () => {
    const data = {
      windows: [
        { ref: '@w1', app: 'TextEdit', title: 'Untitled', minimized: false, hidden: false },
        { ref: '@w2', app: 'Finder', title: 'Documents', minimized: true, hidden: false },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('@w1 TextEdit: "Untitled"');
    expect(out).toContain('(minimized)');
  });

  test('apps list formats with bundle id', () => {
    const data = {
      apps: [
        { name: 'TextEdit', bundle_id: 'com.apple.TextEdit', is_active: true, is_hidden: false },
        { name: 'Finder', bundle_id: 'com.apple.finder', is_active: false, is_hidden: false },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('TextEdit *');
    expect(out).toContain('[com.apple.TextEdit]');
    expect(out).toContain('Finder');
  });

  test('find results format as list', () => {
    const data = {
      elements: [
        { ref: '@b1', role: 'button', label: 'Save' },
        { ref: '@b2', role: 'button', label: 'Cancel' },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('[@b1] button');
    expect(out).toContain('"Save"');
    expect(out).toContain('[@b2] button');
  });

  test('dialog detection formats correctly', () => {
    const data = {
      ok: true,
      found: true,
      dialog: {
        type: 'sheet',
        message: 'Save the document?',
        buttons: [{ title: 'Save' }, { title: 'Cancel' }]
      }
    };
    const out = formatOutput(data, true);
    expect(out).toContain('Dialog: sheet');
    expect(out).toContain('Save the document?');
    expect(out).toContain('Save, Cancel');
  });

  test('dialog not found formats', () => {
    const data = { ok: true, found: false, dialog: undefined };
    const out = formatOutput(data, true);
    expect(out).toContain('No dialog found');
  });

  test('batch results format with status', () => {
    const data = {
      ok: true,
      count: 3,
      total: 3,
      results: [
        { index: 0, method: 'ping', result: { pong: true } },
        { index: 1, method: 'version', result: { version: '0.1.0' } },
        { index: 2, method: 'status', result: {} },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('3/3 completed');
    expect(out).toContain('[0] ping: OK');
    expect(out).toContain('[1] version: OK');
  });

  test('batch with errors shows error message', () => {
    const data = {
      ok: false,
      count: 2,
      total: 3,
      results: [
        { index: 0, method: 'ping', result: {} },
        { index: 1, method: 'bad', error: 'Method not found' },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('stopped on error');
    expect(out).toContain('[1] bad: ERROR');
  });

  test('changed result shows change status', () => {
    const data = { ok: true, changed: true, added_count: 5, removed_count: 2 };
    const out = formatOutput(data, true);
    expect(out).toContain('Changes detected');
    expect(out).toContain('Added: 5');
    expect(out).toContain('Removed: 2');
  });

  test('no change result', () => {
    const data = { ok: true, changed: false };
    const out = formatOutput(data, true);
    expect(out).toContain('No changes');
  });

  test('menu items format as indented list', () => {
    const data = {
      ok: true,
      items: [
        { title: 'File' },
        { title: 'Edit' },
        { title: 'View' },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('Menus');
    expect(out).toContain('File');
    expect(out).toContain('Edit');
  });

  test('menu items with submenu name', () => {
    const data = {
      ok: true,
      menu: 'Edit',
      items: [
        { title: 'Undo', enabled: true },
        { title: 'Redo', enabled: false },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('Menu: Edit');
    expect(out).toContain('Redo (disabled)');
  });

  test('screenshot formats path and dimensions', () => {
    const data = { ok: true, path: '/tmp/screenshot.png', width: 1920, height: 1080 };
    const out = formatOutput(data, true);
    expect(out).toContain('/tmp/screenshot.png');
    expect(out).toContain('1920x1080');
  });

  test('displays format with details', () => {
    const data = {
      displays: [
        { id: 1, width: 2560, height: 1440, x: 0, y: 0, is_main: true, scale_factor: 2 },
      ]
    };
    const out = formatOutput(data, true);
    expect(out).toContain('Display 1 (main)');
    expect(out).toContain('2560x1440');
    expect(out).toContain('scale=2');
  });

  test('permissions format', () => {
    const data = { accessibility: true, screen_recording: false };
    const out = formatOutput(data, true);
    expect(out).toContain('Accessibility: granted');
    expect(out).toContain('Screen Recording: NOT GRANTED');
  });

  test('simple ok result', () => {
    const data = { ok: true };
    const out = formatOutput(data, true);
    expect(out).toBe('OK');
  });

  test('ok with extra info', () => {
    const data = { ok: true, action: 'accept' };
    const out = formatOutput(data, true);
    expect(out).toContain('OK');
    expect(out).toContain('action: accept');
  });

  test('clipboard text returns raw text', () => {
    const data = { text: 'Hello World' };
    const out = formatOutput(data, true);
    expect(out).toBe('Hello World');
  });
});

describe('Output Formatting — JSON Mode', () => {
  test('json mode returns formatted JSON', () => {
    const data = { ok: true, value: 42 };
    const out = formatOutput(data, false);
    expect(JSON.parse(out)).toEqual(data);
  });
});

describe('Content Boundary', () => {
  test('wrapBoundary wraps content with unique boundary', () => {
    const out = wrapBoundary('hello');
    expect(out).toMatch(/^<<<AC_BOUNDARY_[a-f0-9]+\nhello\nAC_BOUNDARY_[a-f0-9]+>>>$/);
  });

  test('wrapBoundary generates different boundaries each time', () => {
    const a = wrapBoundary('test');
    const b = wrapBoundary('test');
    const boundaryA = a.split('\n')[0];
    const boundaryB = b.split('\n')[0];
    expect(boundaryA).not.toBe(boundaryB);
  });
});

describe('Truncation', () => {
  test('truncateOutput returns original if under limit', () => {
    expect(truncateOutput('short', 100)).toBe('short');
  });

  test('truncateOutput truncates long output', () => {
    const long = 'x'.repeat(200);
    const out = truncateOutput(long, 50);
    expect(out.length).toBeLessThan(100);
    expect(out).toContain('truncated at 50 chars');
  });
});
