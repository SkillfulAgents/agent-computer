import { execSync, spawn, type ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as http from 'http';
import { Bridge } from '../../src/bridge.js';

const ELECTRON_APP_DIR = 'native/electron-test-app';
const STATUS_FILE = '/tmp/ac-electron-test-status.txt';
const APP_NAME = 'AC Electron Test App';
const DEFAULT_CDP_PORT = 19222;

let electronProcess: ChildProcess | null = null;

/**
 * Ensure npm dependencies are installed for the Electron test app
 */
export function buildElectronTestApp(): void {
  const nodeModulesPath = `${process.cwd()}/${ELECTRON_APP_DIR}/node_modules`;
  if (!existsSync(nodeModulesPath)) {
    execSync('npm install', {
      cwd: `${process.cwd()}/${ELECTRON_APP_DIR}`,
      stdio: 'pipe',
      timeout: 120000,
    });
  }
}

/**
 * Launch the Electron test app with CDP enabled.
 * Spawns the Electron binary directly with --remote-debugging-port.
 */
export async function launchElectronTestApp(bridge: Bridge, port = DEFAULT_CDP_PORT): Promise<void> {
  // Build if needed
  buildElectronTestApp();

  // Clear status file
  clearElectronTestAppStatus();

  // Kill any existing instance
  if (electronProcess) {
    try { electronProcess.kill('SIGTERM'); } catch { /* ok */ }
    electronProcess = null;
    await sleep(500);
  }

  // Find the electron binary
  const electronBin = `${process.cwd()}/${ELECTRON_APP_DIR}/node_modules/.bin/electron`;
  const appPath = `${process.cwd()}/${ELECTRON_APP_DIR}`;

  if (!existsSync(electronBin)) {
    throw new Error(`Electron binary not found at ${electronBin}. Run buildElectronTestApp() first.`);
  }

  // Launch with CDP
  electronProcess = spawn(electronBin, [
    appPath,
    `--remote-debugging-port=${port}`,
  ], {
    stdio: 'pipe',
    env: { ...process.env },
  });

  electronProcess.on('exit', () => {
    electronProcess = null;
  });

  // Wait for the app to start and CDP to be available
  await waitForCDPEndpoint(port, 15000);
  await sleep(1000);
}

/**
 * Wait for CDP endpoint to become available
 */
async function waitForCDPEndpoint(port: number, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetchJSON(`http://127.0.0.1:${port}/json/list`);
      if (Array.isArray(response) && response.some((t: any) => t.type === 'page')) {
        return;
      }
    } catch {
      // Not ready yet
    }
    await sleep(300);
  }
  throw new Error(`CDP endpoint not available on port ${port} after ${timeout}ms`);
}

/**
 * Simple HTTP GET that returns parsed JSON
 */
function fetchJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Quit the Electron test app
 */
export async function quitElectronTestApp(bridge: Bridge): Promise<void> {
  if (electronProcess) {
    try { electronProcess.kill('SIGTERM'); } catch { /* ok */ }
    electronProcess = null;
  }
  await sleep(500);
}

/**
 * Read the status file written by the Electron test app
 */
export function readElectronTestAppStatus(): string {
  if (!existsSync(STATUS_FILE)) return '';
  return readFileSync(STATUS_FILE, 'utf-8');
}

/**
 * Get the last status line
 */
export function getLastElectronStatus(): string {
  const content = readElectronTestAppStatus();
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';
  // Each line is: "ISO_DATE STATUS"
  const last = lines[lines.length - 1];
  const spaceIdx = last.indexOf(' ');
  return spaceIdx > 0 ? last.slice(spaceIdx + 1) : last;
}

/**
 * Wait for a specific status to appear
 */
export async function waitForElectronStatus(
  contains: string,
  timeoutMs = 5000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = readElectronTestAppStatus();
    if (status.includes(contains)) return true;
    await sleep(200);
  }
  return false;
}

/**
 * Clear the status file
 */
export function clearElectronTestAppStatus(): void {
  writeFileSync(STATUS_FILE, '', 'utf-8');
}

export const ELECTRON_APP_NAME = APP_NAME;
export const ELECTRON_CDP_PORT = DEFAULT_CDP_PORT;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
