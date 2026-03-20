import { describe, test, expect } from 'vitest';

// We'll test the CDPClient by mocking its dependencies
// Since CDPClient constructor takes a port and does real connection,
// we test the facade logic through its public interface patterns

describe('CDP Client (unit)', () => {
  test('CDPClient can be imported', async () => {
    const { CDPClient } = await import('../../src/cdp/client.js');
    expect(CDPClient).toBeDefined();
  });

  test('CDPClient constructor stores port', async () => {
    const { CDPClient } = await import('../../src/cdp/client.js');
    const client = new CDPClient(19222);
    expect(client.isConnected()).toBe(false);
  });

  test('operations throw when not connected', async () => {
    const { CDPClient } = await import('../../src/cdp/client.js');
    const client = new CDPClient(19222);

    await expect(client.snapshot({}, {} as any)).rejects.toThrow();
  });

  test('find searches last elements', async () => {
    const { CDPClient } = await import('../../src/cdp/client.js');
    const client = new CDPClient(19222);

    // With no snapshot taken, find should return empty
    const result = client.find('anything');
    expect(result.elements).toHaveLength(0);
  });
});
