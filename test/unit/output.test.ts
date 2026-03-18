import { describe, test, expect } from 'vitest';
import { formatOutput, wrapBoundary, truncateOutput } from '../../src/cli/output.js';

describe('formatOutput', () => {
  test('JSON mode outputs formatted JSON', () => {
    const data = { pong: true };
    const result = formatOutput(data, false);
    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  test('text mode formats key-value pairs', () => {
    const data = { accessibility: true, screen_recording: false };
    const result = formatOutput(data, true);
    expect(result).toContain('accessibility: true');
    expect(result).toContain('screen_recording: false');
  });

  test('text mode formats snapshot as tree', () => {
    const data = {
      snapshot_id: 'abc',
      elements: [
        {
          ref: '@b1', role: 'button', label: 'Save', value: null,
          enabled: true, focused: false, bounds: [10, 20, 80, 24],
        },
        {
          ref: '@t1', role: 'textfield', label: 'Name', value: 'hello',
          enabled: true, focused: true, bounds: [10, 50, 200, 30],
        },
      ],
    };
    const result = formatOutput(data, true);
    expect(result).toContain('[@b1]');
    expect(result).toContain('Button');
    expect(result).toContain('"Save"');
    expect(result).toContain('*[@t1]'); // focused marker
    expect(result).toContain('Textfield');
    expect(result).toContain('value="hello"');
  });

  test('text mode formats nested snapshot tree', () => {
    const data = {
      snapshot_id: 'abc',
      elements: [
        {
          ref: '@g1', role: 'group', label: 'Toolbar', value: null,
          enabled: true, focused: false, bounds: [0, 0, 800, 40],
          children: [
            {
              ref: '@b1', role: 'button', label: 'Save', value: null,
              enabled: true, focused: false, bounds: [10, 5, 80, 24],
            },
          ],
        },
      ],
    };
    const result = formatOutput(data, true);
    const lines = result.split('\n');
    // Group should be at indent 0
    expect(lines[0]).toMatch(/^\[@g1\]/);
    // Button should be indented
    expect(lines[1]).toMatch(/^  \[@b1\]/);
  });

  test('text mode handles null/undefined', () => {
    expect(formatOutput(null, true)).toBe('');
    expect(formatOutput(undefined, true)).toBe('');
  });

  test('text mode handles string', () => {
    expect(formatOutput('hello', true)).toBe('hello');
  });
});

describe('wrapBoundary', () => {
  test('wraps content in boundary markers', () => {
    const result = wrapBoundary('hello world');
    expect(result).toMatch(/^<<<AC_BOUNDARY_[0-9a-f]+\nhello world\nAC_BOUNDARY_[0-9a-f]+>>>$/);
  });

  test('boundary markers match', () => {
    const result = wrapBoundary('test');
    const lines = result.split('\n');
    const openBoundary = lines[0].replace('<<<', '');
    const closeBoundary = lines[lines.length - 1].replace('>>>', '');
    expect(openBoundary).toBe(closeBoundary);
  });
});

describe('truncateOutput', () => {
  test('short content unchanged', () => {
    expect(truncateOutput('hello', 100)).toBe('hello');
  });

  test('long content truncated', () => {
    const long = 'a'.repeat(200);
    const result = truncateOutput(long, 50);
    expect(result.length).toBeLessThan(100); // truncated + message
    expect(result).toContain('truncated at 50 chars');
  });
});
