import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import { discoverTargets, findPageTarget, waitForCDP } from '../../src/cdp/discovery.js';

describe('CDP Discovery', () => {
  let server: http.Server;
  let port: number;
  let responseData: unknown;

  beforeEach(async () => {
    responseData = [
      {
        id: 'page-1',
        title: 'Test Page',
        type: 'page',
        url: 'http://localhost/index.html',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/page-1',
      },
      {
        id: 'worker-1',
        title: 'Service Worker',
        type: 'service_worker',
        url: 'http://localhost/sw.js',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/worker/worker-1',
      },
    ];

    server = http.createServer((req, res) => {
      if (req.url === '/json/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    port = (server.address() as any).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('discoverTargets parses target list', async () => {
    const targets = await discoverTargets(port);
    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('page-1');
    expect(targets[0].type).toBe('page');
    expect(targets[1].type).toBe('service_worker');
  });

  test('findPageTarget filters for page type', async () => {
    const target = await findPageTarget(port);
    expect(target.type).toBe('page');
    expect(target.id).toBe('page-1');
    expect(target.webSocketDebuggerUrl).toContain('devtools/page');
  });

  test('findPageTarget throws when no page target', async () => {
    responseData = [
      { id: 'worker', title: 'Worker', type: 'service_worker', url: '', webSocketDebuggerUrl: '' },
    ];
    await expect(findPageTarget(port)).rejects.toThrow('No page target');
  });

  test('waitForCDP retries until target appears', async () => {
    let callCount = 0;
    const delayServer = http.createServer((req, res) => {
      callCount++;
      if (req.url === '/json/list') {
        if (callCount < 3) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('[]'); // Empty initially
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{
            id: 'page-1', title: 'Test', type: 'page', url: '', webSocketDebuggerUrl: 'ws://x',
          }]));
        }
      }
    });

    await new Promise<void>(resolve => delayServer.listen(0, '127.0.0.1', resolve));
    const delayPort = (delayServer.address() as any).port;

    const target = await waitForCDP(delayPort, 5000);
    expect(target.id).toBe('page-1');
    expect(callCount).toBeGreaterThanOrEqual(3);

    await new Promise<void>(resolve => delayServer.close(() => resolve()));
  });

  test('waitForCDP times out', async () => {
    const deadPort = 19299; // Nothing listening here
    await expect(waitForCDP(deadPort, 500)).rejects.toThrow('not available');
  }, 5000);

  test('discoverTargets fails on connection refused', async () => {
    await expect(discoverTargets(19299)).rejects.toThrow();
  });
});
