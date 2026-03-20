import { describe, test, expect } from 'vitest';
import { findFreePort } from '../../src/cdp/port-manager.js';

describe('CDP Port Manager', () => {
  test('findFreePort returns a port in range', async () => {
    const port = await findFreePort();
    expect(port).toBeGreaterThanOrEqual(19200);
    expect(port).toBeLessThanOrEqual(19299);
  });
});
