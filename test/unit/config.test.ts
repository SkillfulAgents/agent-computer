import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { resolveConfig, getDefaults, setConfigValue, resetConfig, getConfigValue } from '../../src/config.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'ac');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

describe('Config Defaults', () => {
  const defaults = getDefaults();

  test('default-timeout is 10000', () => {
    expect(defaults['default-timeout']).toBe(10000);
  });

  test('screenshot-dir is /tmp/ac', () => {
    expect(defaults['screenshot-dir']).toBe('/tmp/ac');
  });

  test('screenshot-format is png', () => {
    expect(defaults['screenshot-format']).toBe('png');
  });

  test('retina is false', () => {
    expect(defaults.retina).toBe(false);
  });

  test('content-boundary is false', () => {
    expect(defaults['content-boundary']).toBe(false);
  });

  test('daemon-idle-timeout is 300000', () => {
    expect(defaults['daemon-idle-timeout']).toBe(300000);
  });

  test('getDefaults returns a copy (mutations do not affect original)', () => {
    const d1 = getDefaults();
    const d2 = getDefaults();
    d1['default-timeout'] = 999;
    expect(d2['default-timeout']).toBe(10000);
  });
});

describe('Config File Operations', () => {
  let originalConfig: string | null = null;

  beforeAll(() => {
    // Save existing config once before the suite
    try {
      originalConfig = readFileSync(CONFIG_FILE, 'utf-8');
    } catch {
      originalConfig = null;
    }
  });

  afterAll(() => {
    // Restore original config after the entire suite
    if (originalConfig !== null) {
      mkdirSync(CONFIG_DIR, { recursive: true });
      writeFileSync(CONFIG_FILE, originalConfig);
    } else {
      try { rmSync(CONFIG_FILE); } catch { /* ok */ }
    }
  });

  afterEach(() => {
    // Reset config file after each test to avoid cross-contamination
    resetConfig();
  });

  test('setConfigValue creates config file and sets value', () => {
    setConfigValue('default-timeout', 5000);
    expect(existsSync(CONFIG_FILE)).toBe(true);
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    expect(raw['default-timeout']).toBe(5000);
  });

  test('setConfigValue preserves existing values', () => {
    setConfigValue('default-timeout', 5000);
    setConfigValue('retina', true);
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    expect(raw['default-timeout']).toBe(5000);
    expect(raw.retina).toBe(true);
  });

  test('resetConfig clears all values', () => {
    setConfigValue('default-timeout', 5000);
    resetConfig();
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    expect(raw).toEqual({});
  });

  test('resolveConfig merges file values over defaults', () => {
    setConfigValue('default-timeout', 7777);
    const config = resolveConfig();
    expect(config['default-timeout']).toBe(7777);
    expect(config['screenshot-dir']).toBe('/tmp/ac'); // default preserved
  });

  test('getConfigValue reads from merged config', () => {
    setConfigValue('retina', true);
    expect(getConfigValue('retina')).toBe(true);
  });

  test('resolveConfig works with missing config file', () => {
    try { rmSync(CONFIG_FILE); } catch { /* ok */ }
    const config = resolveConfig();
    expect(config['default-timeout']).toBe(10000); // default
  });

  test('resolveConfig works with invalid JSON in config file', () => {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, 'not valid json');
    const config = resolveConfig();
    expect(config['default-timeout']).toBe(10000); // falls back to defaults
  });
});

describe('Environment Variable Overrides', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.AC_TIMEOUT = process.env.AC_TIMEOUT;
    originalEnv.AC_SCREENSHOT_DIR = process.env.AC_SCREENSHOT_DIR;
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  test('AC_TIMEOUT overrides default-timeout', () => {
    process.env.AC_TIMEOUT = '3000';
    const config = resolveConfig();
    expect(config['default-timeout']).toBe(3000);
  });

  test('AC_SCREENSHOT_DIR overrides screenshot-dir', () => {
    process.env.AC_SCREENSHOT_DIR = '/custom/path';
    const config = resolveConfig();
    expect(config['screenshot-dir']).toBe('/custom/path');
  });

  test('env vars override file config', () => {
    setConfigValue('default-timeout', 5000);
    process.env.AC_TIMEOUT = '2000';
    const config = resolveConfig();
    expect(config['default-timeout']).toBe(2000); // env wins
  });
});
