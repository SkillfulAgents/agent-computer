import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';
import { launchTestApp, quitTestApp, TEST_APP_NAME } from '../helpers/test-app.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Functional — Batch', () => {
  const bridge = new Bridge({ timeout: 20000 });

  beforeAll(async () => {
    await launchTestApp(bridge);
  }, 60000);

  afterAll(async () => {
    await quitTestApp(bridge);
    await bridge.disconnect();
  });

  test('batch ping+version+status sequence', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['version'],
        ['status'],
      ]
    }) as any;

    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(result.total).toBe(3);
    expect(result.results[0].method).toBe('ping');
    expect(result.results[1].method).toBe('version');
    expect(result.results[2].method).toBe('status');
  });

  test('batch with clipboard roundtrip', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['clipboard_set', { text: 'batch-functional-test' }],
        ['clipboard_read'],
      ]
    }) as any;

    expect(result.ok).toBe(true);
    const readResult = result.results[1].result;
    expect(readResult.text).toBe('batch-functional-test');
  });

  test('batch stops on first error', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['click', { ref: '@nonexistent999' }],
        ['version'],
      ],
      stop_on_error: true
    }) as any;

    expect(result.ok).toBe(false);
    expect(result.count).toBe(2);
    expect(result.results[1].error).toBeDefined();
  });
});
