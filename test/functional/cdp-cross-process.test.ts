/**
 * Tests that CDP state persists across separate CLI invocations via the daemon.
 * Each `ac` command is a separate process — this is how real users work.
 */
import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';

/** Run an ac CLI command as a separate process */
function ac(command: string): string {
  try {
    return execSync(`npx tsx bin/ac.ts ${command}`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    return ((err.stdout ?? '') + (err.stderr ?? '')).trim() || err.message;
  }
}

function acJSON(command: string): any {
  const raw = ac(`${command} --json`);
  return JSON.parse(raw);
}

describe('Functional — CDP Cross-Process State', () => {

  test('status includes grabbed_app and grabbed_pid fields', () => {
    const status = acJSON('status');
    expect('grabbed_app' in status).toBe(true);
    expect('grabbed_pid' in status).toBe(true);
    expect('daemon_pid' in status).toBe(true);
  });

  test('grab sends app param for plain name, ref for @ref', () => {
    // This is the CLI-level fix we made: "Spotify" → { app: "Spotify" }
    // We can't easily test the param sent, but we can test the behavior:
    // grabbing by a non-existent app name should give a "not found" error (not "invalid ref")
    const result = ac('grab NonExistentApp12345');
    // Should say "No window found for app:" not "Missing window ref" (which would mean it treated the name as a ref)
    expect(result).toContain('No window found for app');
    expect(result).not.toContain('Missing window ref');
  });

  test('grab by @ref that does not exist gives window not found', () => {
    const result = ac('grab @w999');
    expect(result.toLowerCase()).toContain('not found');
  });
});
