import { describe, test, expect } from 'vitest';
import { getDefaults } from '../../src/config.js';

describe('Config Defaults', () => {
  const defaults = getDefaults();

  test('default-timeout is 10000', () => {
    expect(defaults['default-timeout']).toBe(10000);
  });

  test('screenshot-dir is /tmp/ac', () => {
    expect(defaults['screenshot-dir']).toBe('/tmp/ac');
  });

  test('screenshot-format is png', () => {
    expect(defaults['screenshot-format']).toBe('png');
  });

  test('retina is false', () => {
    expect(defaults.retina).toBe(false);
  });

  test('content-boundary is false', () => {
    expect(defaults['content-boundary']).toBe(false);
  });

  test('daemon-idle-timeout is 300000', () => {
    expect(defaults['daemon-idle-timeout']).toBe(300000);
  });
});
