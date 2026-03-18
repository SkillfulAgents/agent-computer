import { describe, test, expect } from 'vitest';
import {
  errorFromCode, exitCodeFromErrorCode,
  ElementNotFoundError, PermissionDeniedError, TimeoutError,
  AppNotFoundError, WindowNotFoundError, InvalidRefError,
  MethodNotFoundError, ACError,
} from '../../src/errors.js';

describe('errorFromCode', () => {
  test.each([
    [-32001, 'ELEMENT_NOT_FOUND', 1],
    [-32002, 'PERMISSION_DENIED', 2],
    [-32003, 'TIMEOUT', 3],
    [-32004, 'APP_NOT_FOUND', 4],
    [-32005, 'WINDOW_NOT_FOUND', 5],
    [-32006, 'INVALID_REF', 6],
    [-32007, 'OCR_FALLBACK_FAILED', 7],
    [-32600, 'INVALID_REQUEST', 126],
    [-32601, 'METHOD_NOT_FOUND', 126],
    [-32602, 'INVALID_PARAMS', 126],
  ])('code %d → name=%s, exitCode=%d', (code, name, exitCode) => {
    const err = errorFromCode(code, 'test message');
    expect(err.name).toBe(name);
    expect(err.code).toBe(code);
    expect(err.exitCode).toBe(exitCode);
    expect(err.message).toBe('test message');
    expect(err).toBeInstanceOf(ACError);
  });

  test('unknown code returns generic ACError', () => {
    const err = errorFromCode(-99999, 'unknown');
    expect(err).toBeInstanceOf(ACError);
    expect(err.exitCode).toBe(126);
  });

  test('error includes data when provided', () => {
    const err = errorFromCode(-32001, 'not found', { ref: '@b99' });
    expect(err.data).toEqual({ ref: '@b99' });
  });
});

describe('exitCodeFromErrorCode', () => {
  test('maps known codes correctly', () => {
    expect(exitCodeFromErrorCode(-32001)).toBe(1);
    expect(exitCodeFromErrorCode(-32003)).toBe(3);
    expect(exitCodeFromErrorCode(-32005)).toBe(5);
  });

  test('unknown code returns 126', () => {
    expect(exitCodeFromErrorCode(-99999)).toBe(126);
  });
});
