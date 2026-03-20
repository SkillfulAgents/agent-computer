import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Bridge } from '../../src/bridge.js';

const TEST_APP_BINARY = 'native/macos/TestApp/.build/debug/ACTestApp';
const STATUS_FILE = '/tmp/ac-test-status.txt';
const APP_NAME = 'ACTestApp';

let testAppProcess: ChildProcess | null = null;

/**
 * Build and launch the ACTestApp.
 * Returns a Bridge connected to the daemon.
 */
export async function launchTestApp(bridge: Bridge): Promise<void> {
  // Build the test app if needed
  const binaryPath = `${process.cwd()}/${TEST_APP_BINARY}`;
  if (!existsSync(binaryPath)) {
    execSync('cd native/macos/TestApp && swift build', {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 120000,
    });
  }

  // Clear status file
  clearTestAppStatus();

  // Kill any existing instance
  try {
    await bridge.send('quit', { name: APP_NAME, force: true });
  } catch { /* ok */ }
  await sleep(500);

  // Launch the app using `open` so macOS LaunchServices handles it
  // This gives better accessibility trust than raw spawn
  try {
    execSync(`open "${binaryPath}"`, { stdio: 'pipe', timeout: 10000 });
  } catch {
    // Fallback to direct spawn
    testAppProcess = spawn(binaryPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    testAppProcess.unref();
  }

  // Wait for it to appear
  await sleep(3000);

  // Activate it
  try {
    await bridge.send('switch', { name: APP_NAME });
  } catch {
    // Might not be recognized by name yet, wait more
    await sleep(1000);
    await bridge.send('switch', { name: APP_NAME });
  }
  await sleep(500);
}

/**
 * Quit the test app
 */
export async function quitTestApp(bridge: Bridge): Promise<void> {
  try {
    await bridge.send('quit', { name: APP_NAME, force: true });
  } catch { /* ok */ }
  if (testAppProcess) {
    try { testAppProcess.kill('SIGTERM'); } catch { /* ok */ }
    testAppProcess = null;
  }
  await sleep(500);
}

/**
 * Read the status file written by the test app
 */
export function readTestAppStatus(): string {
  if (!existsSync(STATUS_FILE)) return '';
  return readFileSync(STATUS_FILE, 'utf-8');
}

/**
 * Get the last status line
 */
export function getLastStatus(): string {
  const content = readTestAppStatus();
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';
  // Each line is: "ISO_DATE STATUS"
  const last = lines[lines.length - 1];
  const spaceIdx = last.indexOf(' ');
  return spaceIdx > 0 ? last.slice(spaceIdx + 1) : last;
}

/**
 * Wait for a specific status to appear in the status file
 */
export async function waitForStatus(
  contains: string,
  timeoutMs = 5000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = readTestAppStatus();
    if (status.includes(contains)) return true;
    await sleep(200);
  }
  return false;
}

/**
 * Clear the status file
 */
export function clearTestAppStatus(): void {
  writeFileSync(STATUS_FILE, '', 'utf-8');
}

export const TEST_APP_NAME = APP_NAME;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
