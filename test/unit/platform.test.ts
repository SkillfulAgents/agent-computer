import { describe, test, expect } from 'vitest';
import { platform } from 'os';

describe('Platform Detection', () => {
  test('current platform is supported', () => {
    expect(['darwin', 'win32']).toContain(platform());
  });

  test('platform-specific paths are correct', async () => {
    const { SOCKET_PATH, AC_DIR, IS_NAMED_PIPE } = await import('../../src/platform/index.js');

    expect(AC_DIR).toContain('.ac');

    if (platform() === 'win32') {
      expect(SOCKET_PATH).toBe('\\\\.\\pipe\\ac-daemon');
      expect(IS_NAMED_PIPE).toBe(true);
    } else {
      expect(SOCKET_PATH).toContain('daemon.sock');
      expect(IS_NAMED_PIPE).toBe(false);
    }
  });

  // resolveBinary will be tested in integration tests once the binary is built
});
