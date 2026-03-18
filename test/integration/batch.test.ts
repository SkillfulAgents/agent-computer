import { describe, test, expect, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Batch', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('batch executes sequence of commands', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['version'],
        ['status'],
      ]
    }) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.count).toBe(3);
    expect(result.total).toBe(3);

    const results = result.results as any[];
    expect(results).toHaveLength(3);

    // Ping result
    expect(results[0].method).toBe('ping');
    expect(results[0].result).toBeDefined();

    // Version result
    expect(results[1].method).toBe('version');
    expect(results[1].result).toBeDefined();
  });

  test('batch stops on error by default', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['nonexistent_method'],
        ['version'],
      ]
    }) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.count).toBe(2); // stopped at error
    expect(result.total).toBe(3);

    const results = result.results as any[];
    expect(results[0].method).toBe('ping');
    expect(results[1].error).toBeDefined();
  });

  test('batch continues on error with stop_on_error=false', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['ping'],
        ['nonexistent_method'],
        ['version'],
      ],
      stop_on_error: false
    }) as Record<string, unknown>;

    expect(result.ok).toBe(true); // didn't "fail" since we don't stop
    expect(result.count).toBe(3);

    const results = result.results as any[];
    expect(results[0].method).toBe('ping');
    expect(results[1].error).toBeDefined();
    expect(results[2].method).toBe('version');
  });

  test('batch with empty commands returns error', async () => {
    try {
      await bridge.send('batch', { commands: [] });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('batch with missing commands returns error', async () => {
    try {
      await bridge.send('batch', {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('batch with named params', async () => {
    const result = await bridge.send('batch', {
      commands: [
        ['clipboard_set', { text: 'batch-test-123' }],
        ['clipboard_read'],
      ]
    }) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);

    const results = result.results as any[];
    // Read result should contain the text we set
    const readResult = results[1].result as Record<string, unknown>;
    expect(readResult.text).toBe('batch-test-123');
  });
});
