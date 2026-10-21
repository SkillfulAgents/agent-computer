import { describe, test, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.doUnmock('url');
  vi.doUnmock('os');
  vi.resetModules();
});

describe('resolveBinary module', () => {
  test('imports without reading its own file URL', async () => {
    // A runtime without a file URL for the module (Cloudflare Workers) leaves
    // import.meta.url undefined, so fileURLToPath throws there.
    const fileURLToPath = vi.fn(() => {
      throw new TypeError('The "path" argument must be of type string or an instance of URL. Received undefined');
    });
    vi.doMock('url', async (importOriginal) => ({ ...(await importOriginal<typeof import('url')>()), fileURLToPath }));
    vi.doMock('os', async (importOriginal) => ({ ...(await importOriginal<typeof import('os')>()), platform: () => 'darwin' }));

    const { resolveBinary } = await import('../../src/platform/resolve.js');

    expect(fileURLToPath).not.toHaveBeenCalled();
    expect(() => resolveBinary()).toThrow(TypeError);
    expect(fileURLToPath).toHaveBeenCalledTimes(1);
  });
});
