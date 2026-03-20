import * as http from 'http';
import type { CDPTarget } from './types.js';

/** GET http://localhost:{port}/json/list — returns all CDP targets */
export async function discoverTargets(port: number): Promise<CDPTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const targets = JSON.parse(data) as CDPTarget[];
          resolve(targets);
        } catch (err) {
          reject(new Error(`Failed to parse CDP targets: ${err}`));
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`Failed to discover CDP targets on port ${port}: ${err.message}`));
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`CDP discovery timed out on port ${port}`));
    });
  });
}

/** Filter targets for type === 'page' and return first match */
export async function findPageTarget(port: number): Promise<CDPTarget> {
  const targets = await discoverTargets(port);
  const page = targets.find(t => t.type === 'page');
  if (!page) {
    throw new Error(`No page target found on port ${port}. Found: ${targets.map(t => t.type).join(', ')}`);
  }
  return page;
}

/** Poll until a page target appears, with timeout */
export async function waitForCDP(port: number, timeout = 10000): Promise<CDPTarget> {
  const start = Date.now();
  let lastError: Error | undefined;

  while (Date.now() - start < timeout) {
    try {
      return await findPageTarget(port);
    } catch (err) {
      lastError = err as Error;
      await sleep(200);
    }
  }

  throw new Error(`CDP not available on port ${port} after ${timeout}ms: ${lastError?.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
