import { describe, test, expect } from 'vitest';
import { platform } from 'os';

// We can't easily test resolveBinary without the actual binary,
// but we can test the platform detection logic
describe('Platform Detection', () => {
  test('current platform is darwin', () => {
    expect(platform()).toBe('darwin');
  });

  // resolveBinary will be tested in integration tests once the binary is built
});
