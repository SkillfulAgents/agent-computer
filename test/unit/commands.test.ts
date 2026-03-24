import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { registerCommand, getCommand, getAllCommands } from '../../src/cli/commands.js';
import { parseArgs } from '../../src/cli/parser.js';
import { setConfigValue, resetConfig } from '../../src/config.js';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILE = join(homedir(), '.config', 'agent-computer', 'config.json');

describe('Command Registration', () => {
  test('getCommand returns handler for registered command', () => {
    const handler = getCommand('version');
    expect(handler).toBeTypeOf('function');
  });

  test('getCommand returns undefined for unknown command', () => {
    const handler = getCommand('nonexistent_cmd_xyz');
    expect(handler).toBeUndefined();
  });

  test('getAllCommands returns sorted list', () => {
    const commands = getAllCommands();
    expect(commands.length).toBeGreaterThan(0);
    expect(commands).toContain('version');
    expect(commands).toContain('help');
    expect(commands).toContain('daemon');
    expect(commands).toContain('config');
    expect(commands).toContain('ping');
    expect(commands).toContain('status');
    expect(commands).toContain('permissions');
    expect(commands).toContain('doctor');

    // Should be sorted
    const sorted = [...commands].sort();
    expect(commands).toEqual(sorted);
  });
});

describe('Version Command', () => {
  test('returns version string', async () => {
    const handler = getCommand('version')!;
    const result = await handler(parseArgs(['version']), null as any);
    expect(result.exitCode).toBe(0);
    expect(result.data).toEqual({ version: '0.1.0' });
  });
});

describe('Help Command', () => {
  test('returns help text', async () => {
    const handler = getCommand('help')!;
    const result = await handler(parseArgs(['help']), null as any);
    expect(result.exitCode).toBe(0);
    expect(typeof result.data).toBe('string');
    expect(result.data as string).toContain('agent-computer —');
    expect(result.data as string).toContain('snapshot');
    expect(result.data as string).toContain('click');
  });
});

describe('Config Command', () => {
  let originalConfig: string | null = null;

  beforeEach(() => {
    try { originalConfig = readFileSync(CONFIG_FILE, 'utf-8'); } catch { originalConfig = null; }
  });

  afterEach(() => {
    if (originalConfig !== null) {
      mkdirSync(join(homedir(), '.config', 'agent-computer'), { recursive: true });
      writeFileSync(CONFIG_FILE, originalConfig);
    } else {
      try { rmSync(CONFIG_FILE); } catch { /* ok */ }
    }
  });

  test('config with no subcommand shows current config', async () => {
    const handler = getCommand('config')!;
    const result = await handler(parseArgs(['config']), null as any);
    expect(result.exitCode).toBe(0);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('default-timeout');
    expect(data).toHaveProperty('screenshot-dir');
  });

  test('config set stores value', async () => {
    const handler = getCommand('config')!;
    const args = parseArgs(['config', 'set', 'default-timeout', '5000']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({ ok: true, key: 'default-timeout', value: 5000 });
  });

  test('config set with boolean value', async () => {
    const handler = getCommand('config')!;
    const args = parseArgs(['config', 'set', 'retina', 'true']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({ ok: true, key: 'retina', value: true });
  });

  test('config set with unknown key returns error', async () => {
    const handler = getCommand('config')!;
    const args = parseArgs(['config', 'set', 'nonexistent-key', 'value']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(1);
  });

  test('config set without value returns error', async () => {
    const handler = getCommand('config')!;
    const args = parseArgs(['config', 'set', 'default-timeout']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(1);
  });

  test('config reset clears config', async () => {
    const handler = getCommand('config')!;
    // Set a value first
    await handler(parseArgs(['config', 'set', 'retina', 'true']), null as any);
    // Reset
    const result = await handler(parseArgs(['config', 'reset']), null as any);
    expect(result.exitCode).toBe(0);
    expect(result.data).toMatchObject({ ok: true });
  });
});

describe('Daemon Command', () => {
  test('invalid subcommand returns error', async () => {
    const handler = getCommand('daemon')!;
    const args = parseArgs(['daemon', 'invalid']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(1);
    expect((result.data as Record<string, unknown>).error).toContain('Unknown daemon subcommand');
  });

  test('no subcommand returns error', async () => {
    const handler = getCommand('daemon')!;
    const args = parseArgs(['daemon']);
    const result = await handler(args, null as any);
    expect(result.exitCode).toBe(1);
  });
});
