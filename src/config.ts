import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ACConfig {
  'default-timeout': number;
  'screenshot-dir': string;
  'screenshot-format': 'png' | 'jpeg';
  retina: boolean;
  'content-boundary': boolean;
  'daemon-idle-timeout': number;
}

const DEFAULTS: ACConfig = {
  'default-timeout': 10000,
  'screenshot-dir': '/tmp/agent-computer',
  'screenshot-format': 'png',
  retina: false,
  'content-boundary': false,
  'daemon-idle-timeout': 300000,
};

const CONFIG_DIR = join(homedir(), '.config', 'agent-computer');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// Environment variable overrides
const ENV_MAP: Partial<Record<string, keyof ACConfig>> = {
  AC_TIMEOUT: 'default-timeout',
  AC_SCREENSHOT_DIR: 'screenshot-dir',
};

function loadConfigFile(): Partial<ACConfig> {
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Partial<ACConfig>;
  } catch {
    return {};
  }
}

function loadEnvOverrides(): Partial<ACConfig> {
  const overrides: Partial<ACConfig> = {};
  for (const [envVar, configKey] of Object.entries(ENV_MAP)) {
    const val = process.env[envVar];
    if (val !== undefined) {
      if (configKey) {
        if (configKey === 'default-timeout' || configKey === 'daemon-idle-timeout') {
          (overrides as Record<string, unknown>)[configKey] = parseInt(val, 10);
        } else {
          (overrides as Record<string, unknown>)[configKey] = val;
        }
      }
    }
  }
  // Boolean env vars
  if (process.env.AC_JSON === '1') {
    // This is handled at the CLI level, not config
  }
  if (process.env.AC_VERBOSE === '1') {
    // This is handled at the CLI level, not config
  }
  return overrides;
}

export function resolveConfig(): ACConfig {
  const fileConfig = loadConfigFile();
  const envConfig = loadEnvOverrides();
  return { ...DEFAULTS, ...fileConfig, ...envConfig };
}

export function getConfigValue<K extends keyof ACConfig>(key: K): ACConfig[K] {
  return resolveConfig()[key];
}

export function setConfigValue<K extends keyof ACConfig>(key: K, value: ACConfig[K]): void {
  const existing = loadConfigFile();
  (existing as Record<string, unknown>)[key] = value;
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2) + '\n');
}

export function resetConfig(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2) + '\n');
}

export function getDefaults(): ACConfig {
  return { ...DEFAULTS };
}
