import { describe, test, expect, afterAll } from 'vitest';
import { Bridge } from '../../src/bridge.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Drag', () => {
  const bridge = new Bridge({ timeout: 20000 });

  afterAll(async () => {
    await bridge.disconnect();
    await sleep(500);
  });

  test('drag by coordinates returns ok', async () => {
    const result = await bridge.send('drag', {
      from_x: 400, from_y: 400,
      to_x: 500, to_y: 500,
      duration: 0.3,
      steps: 10
    }) as Record<string, unknown>;
    expect(result.ok).toBe(true);
    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
    const from = result.from as Record<string, number>;
    const to = result.to as Record<string, number>;
    expect(from.x).toBe(400);
    expect(from.y).toBe(400);
    expect(to.x).toBe(500);
    expect(to.y).toBe(500);
  });

  test('drag missing from returns error', async () => {
    try {
      await bridge.send('drag', { to_x: 500, to_y: 500 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('drag missing to returns error', async () => {
    try {
      await bridge.send('drag', { from_x: 100, from_y: 100 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32602);
    }
  });

  test('drag with invalid ref returns error', async () => {
    try {
      await bridge.send('drag', { from_ref: '@b999', to_x: 500, to_y: 500 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.code).toBe(-32001);
    }
  });
});
