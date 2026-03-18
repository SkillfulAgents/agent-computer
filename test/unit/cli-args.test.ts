import { describe, test, expect } from 'vitest';
import { parseArgs, parseSelector } from '../../src/cli/parser.js';

// Helper: simulate CLI args (as if process.argv = ['node', 'ac.ts', ...args])
function parse(...args: string[]) {
  return parseArgs(args);
}

describe('CLI Argument Parsing', () => {

  describe('basic commands', () => {
    test('no args → help', () => {
      const result = parseArgs([]);
      expect(result.command).toBe('help');
    });

    test('--version → version command', () => {
      const result = parse('--version');
      expect(result.command).toBe('version');
    });

    test('--help → help command', () => {
      const result = parse('--help');
      expect(result.command).toBe('help');
    });

    test('-h → help command', () => {
      const result = parse('-h');
      expect(result.command).toBe('help');
    });

    test('simple command', () => {
      const result = parse('snapshot');
      expect(result.command).toBe('snapshot');
      expect(result.subcommand).toBeNull();
      expect(result.positional).toEqual([]);
    });

    test('command with positional arg', () => {
      const result = parse('click', '@b1');
      expect(result.command).toBe('click');
      expect(result.positional).toEqual(['@b1']);
    });
  });

  describe('snapshot flags', () => {
    test('-i flag → interactive', () => {
      const result = parse('snapshot', '-i');
      expect(result.command).toBe('snapshot');
      expect(result.flags['interactive']).toBe(true);
    });

    test('-c flag → compact', () => {
      const result = parse('snapshot', '-c');
      expect(result.flags['compact']).toBe(true);
    });

    test('-d N flag → depth', () => {
      const result = parse('snapshot', '-d', '3');
      expect(result.flags['depth']).toBe('3');
    });

    test('--app flag', () => {
      const result = parse('snapshot', '--app', 'TextEdit');
      expect(result.flags['app']).toBe('TextEdit');
    });

    test('--pid flag', () => {
      const result = parse('snapshot', '--pid', '12345');
      expect(result.flags['pid']).toBe('12345');
    });

    test('combined flags', () => {
      const result = parse('snapshot', '-i', '-c', '-d', '2');
      expect(result.flags['interactive']).toBe(true);
      expect(result.flags['compact']).toBe(true);
      expect(result.flags['depth']).toBe('2');
    });
  });

  describe('click flags', () => {
    test('click with --right', () => {
      const result = parse('click', '@b1', '--right');
      expect(result.command).toBe('click');
      expect(result.positional).toEqual(['@b1']);
      expect(result.flags['right']).toBe(true);
    });

    test('click with --double', () => {
      const result = parse('click', '@b1', '--double');
      expect(result.flags['double']).toBe(true);
    });

    test('click with --modifiers', () => {
      const result = parse('click', '@b1', '--modifiers', 'shift,cmd');
      expect(result.flags['modifiers']).toBe('shift,cmd');
    });

    test('click with --count', () => {
      const result = parse('click', '@b1', '--count', '3');
      expect(result.flags['count']).toBe('3');
    });

    test('click with --wait', () => {
      const result = parse('click', '@b1', '--wait');
      expect(result.flags['wait']).toBe(true);
    });

    test('click with --human', () => {
      const result = parse('click', '@b1', '--human');
      expect(result.flags['human']).toBe(true);
    });

    test('click with coordinates', () => {
      const result = parse('click', '100,200');
      expect(result.positional).toEqual(['100,200']);
    });
  });

  describe('subcommands', () => {
    test('daemon start', () => {
      const result = parse('daemon', 'start');
      expect(result.command).toBe('daemon');
      expect(result.subcommand).toBe('start');
    });

    test('daemon status', () => {
      const result = parse('daemon', 'status');
      expect(result.command).toBe('daemon');
      expect(result.subcommand).toBe('status');
    });

    test('menu list', () => {
      const result = parse('menu', 'list');
      expect(result.command).toBe('menu');
      expect(result.subcommand).toBe('list');
    });

    test('menu with path (not a subcommand)', () => {
      const result = parse('menu', 'File > Save');
      expect(result.command).toBe('menu');
      expect(result.subcommand).toBe('File > Save');
    });

    test('clipboard set', () => {
      const result = parse('clipboard', 'set', 'hello world');
      expect(result.command).toBe('clipboard');
      expect(result.subcommand).toBe('set');
      expect(result.positional).toEqual(['hello world']);
    });

    test('config set key value', () => {
      const result = parse('config', 'set', 'default-timeout', '5000');
      expect(result.command).toBe('config');
      expect(result.subcommand).toBe('set');
      expect(result.positional).toEqual(['default-timeout', '5000']);
    });

    test('permissions grant', () => {
      const result = parse('permissions', 'grant');
      expect(result.command).toBe('permissions');
      expect(result.subcommand).toBe('grant');
    });

    test('is visible', () => {
      const result = parse('is', 'visible', '@b1');
      expect(result.command).toBe('is');
      expect(result.subcommand).toBe('visible');
      expect(result.positional).toEqual(['@b1']);
    });

    test('dialog file path', () => {
      const result = parse('dialog', 'file', '/tmp/test.txt');
      expect(result.command).toBe('dialog');
      expect(result.subcommand).toBe('file');
      expect(result.positional).toEqual(['/tmp/test.txt']);
    });

    test('record start', () => {
      const result = parse('record', 'start', '/tmp/recording.mp4');
      expect(result.command).toBe('record');
      expect(result.subcommand).toBe('start');
      expect(result.positional).toEqual(['/tmp/recording.mp4']);
    });
  });

  describe('scroll command', () => {
    test('scroll down', () => {
      const result = parse('scroll', 'down');
      expect(result.command).toBe('scroll');
      expect(result.subcommand).toBe('down');
    });

    test('scroll down with amount', () => {
      const result = parse('scroll', 'down', '5');
      expect(result.command).toBe('scroll');
      expect(result.subcommand).toBe('down');
      expect(result.positional).toEqual(['5']);
    });

    test('scroll with --on flag', () => {
      const result = parse('scroll', 'down', '--on', '@sa1');
      expect(result.subcommand).toBe('down');
      expect(result.flags['on']).toBe('@sa1');
    });

    test('scroll with --smooth', () => {
      const result = parse('scroll', 'up', '--smooth');
      expect(result.subcommand).toBe('up');
      expect(result.flags['smooth']).toBe(true);
    });
  });

  describe('global flags before command', () => {
    test('--text before command', () => {
      const result = parse('--text', 'snapshot');
      expect(result.command).toBe('snapshot');
      expect(result.flags['text']).toBe(true);
    });

    test('--timeout before command', () => {
      const result = parse('--timeout', '5000', 'click', '@b1');
      expect(result.command).toBe('click');
      expect(result.flags['timeout']).toBe('5000');
      expect(result.positional).toEqual(['@b1']);
    });

    test('--verbose before command', () => {
      const result = parse('--verbose', 'status');
      expect(result.command).toBe('status');
      expect(result.flags['verbose']).toBe(true);
    });

    test('--content-boundary', () => {
      const result = parse('--content-boundary', 'snapshot');
      expect(result.command).toBe('snapshot');
      expect(result.flags['content-boundary']).toBe(true);
    });

    test('--max-output', () => {
      const result = parse('--max-output', '1000', 'snapshot');
      expect(result.command).toBe('snapshot');
      expect(result.flags['max-output']).toBe('1000');
    });
  });

  describe('type and fill commands', () => {
    test('type with text', () => {
      const result = parse('type', 'Hello World');
      expect(result.command).toBe('type');
      expect(result.positional).toEqual(['Hello World']);
    });

    test('type with --delay', () => {
      const result = parse('type', 'abc', '--delay', '50');
      expect(result.flags['delay']).toBe('50');
    });

    test('fill with ref and text', () => {
      const result = parse('fill', '@t1', 'Hello');
      expect(result.command).toBe('fill');
      expect(result.positional).toEqual(['@t1', 'Hello']);
    });

    test('key combo', () => {
      const result = parse('key', 'cmd+s');
      expect(result.command).toBe('key');
      expect(result.positional).toEqual(['cmd+s']);
    });

    test('key with --repeat', () => {
      const result = parse('key', 'tab', '--repeat', '3');
      expect(result.flags['repeat']).toBe('3');
    });
  });

  describe('multiple positional args', () => {
    test('drag from to', () => {
      const result = parse('drag', '@b1', '@b2');
      expect(result.positional).toEqual(['@b1', '@b2']);
    });

    test('move window', () => {
      const result = parse('move', '@w1', '100', '200');
      expect(result.positional).toEqual(['@w1', '100', '200']);
    });

    test('bounds with preset', () => {
      const result = parse('bounds', '@w1', '--preset', 'left-half');
      expect(result.positional).toEqual(['@w1']);
      expect(result.flags['preset']).toBe('left-half');
    });
  });
});

describe('Edge cases', () => {
  test('value flag at end of args without value is treated as boolean', () => {
    const result = parse('snapshot', '--timeout');
    // --timeout is a value flag but has no next arg
    // Should be treated as boolean true (no crash)
    expect(result.flags['timeout']).toBe(true);
  });

  test('empty positional string', () => {
    const result = parse('type', '');
    expect(result.positional).toEqual(['']);
  });

  test('multiple global flags before command', () => {
    const result = parse('--text', '--verbose', '--timeout', '3000', 'snapshot');
    expect(result.command).toBe('snapshot');
    expect(result.flags['text']).toBe(true);
    expect(result.flags['verbose']).toBe(true);
    expect(result.flags['timeout']).toBe('3000');
  });
});

describe('parseSelector', () => {
  test('ref selector', () => {
    expect(parseSelector('@b1')).toEqual({ type: 'ref', ref: '@b1' });
    expect(parseSelector('@cb3')).toEqual({ type: 'ref', ref: '@cb3' });
  });

  test('coordinate selector', () => {
    expect(parseSelector('100,200')).toEqual({ type: 'coords', x: 100, y: 200 });
  });

  test('label selector', () => {
    expect(parseSelector('Save')).toEqual({ type: 'label', label: 'Save' });
    expect(parseSelector('My Button')).toEqual({ type: 'label', label: 'My Button' });
  });
});
