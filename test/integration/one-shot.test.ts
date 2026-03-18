import { describe, test, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARY_PATHS = [
  join(__dirname, '../../native/macos/.build/debug/ac-core'),
  join(__dirname, '../../native/macos/.build/release/ac-core'),
];

let BINARY = '';

beforeAll(() => {
  BINARY = BINARY_PATHS.find(p => existsSync(p)) ?? '';
  if (!BINARY) {
    throw new Error('ac-core binary not found. Run: cd native/macos && swift build');
  }
});

function runBinary(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(BINARY, args, { encoding: 'utf-8', timeout: 5000 });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err: any) {
    return { stdout: (err.stdout ?? '').trim(), exitCode: err.status ?? 1 };
  }
}

function runBinaryJSON(args: string[]): { result: any; exitCode: number } {
  const { stdout, exitCode } = runBinary(args);
  try {
    return { result: JSON.parse(stdout), exitCode };
  } catch {
    return { result: null, exitCode };
  }
}

describe('One-Shot Mode', () => {

  test('--version returns semver', () => {
    const { stdout, exitCode } = runBinary(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('ping returns pong', () => {
    const { result, exitCode } = runBinaryJSON(['ping']);
    expect(exitCode).toBe(0);
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result.pong).toBe(true);
  });

  test('status returns session state', () => {
    const { result, exitCode } = runBinaryJSON(['status']);
    expect(exitCode).toBe(0);
    expect(result.result).toHaveProperty('grabbed_window');
    expect(result.result).toHaveProperty('last_snapshot_id');
    expect(result.result).toHaveProperty('daemon_pid');
    expect(result.result).toHaveProperty('daemon_uptime_ms');
  });

  test('version method returns version object', () => {
    const { result, exitCode } = runBinaryJSON(['version']);
    expect(exitCode).toBe(0);
    expect(result.result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('permissions returns boolean fields', () => {
    const { result, exitCode } = runBinaryJSON(['permissions']);
    expect(exitCode).toBe(0);
    expect(typeof result.result.accessibility).toBe('boolean');
    expect(typeof result.result.screen_recording).toBe('boolean');
  });

  test('unknown method returns METHOD_NOT_FOUND error', () => {
    const { result, exitCode } = runBinaryJSON(['nonexistent']);
    expect(exitCode).toBe(126);
    expect(result.error.code).toBe(-32601);
    expect(result.error.message).toContain('nonexistent');
  });

  test('stdin pipe mode works', () => {
    const input = JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'ping', params: {} });
    const stdout = execFileSync(BINARY, [], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    }).trim();
    const result = JSON.parse(stdout);
    expect(result.id).toBe(42);
    expect(result.result.pong).toBe(true);
  });

  test('stdin pipe with status method', () => {
    const input = JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'status', params: {} });
    const stdout = execFileSync(BINARY, [], {
      encoding: 'utf-8',
      input,
      timeout: 5000,
    }).trim();
    const result = JSON.parse(stdout);
    expect(result.id).toBe(7);
    expect(result.result.daemon_pid).toBeTypeOf('number');
  });
});
