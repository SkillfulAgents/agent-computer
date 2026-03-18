import { describe, test, expect, beforeEach } from 'vitest';
import { buildRequest, parseResponse, _resetIdCounter } from '../../src/bridge.js';
import { ACError } from '../../src/errors.js';

describe('buildRequest', () => {
  beforeEach(() => _resetIdCounter());

  test('creates valid JSON-RPC request', () => {
    const req = buildRequest('click', { ref: '@b3' });
    expect(req).toMatchObject({
      jsonrpc: '2.0',
      method: 'click',
      params: { ref: '@b3' },
    });
    expect(typeof req.id).toBe('number');
    expect(req.id).toBeGreaterThan(0);
  });

  test('increments ID on each call', () => {
    const req1 = buildRequest('snapshot', {});
    const req2 = buildRequest('click', { ref: '@b1' });
    expect(req2.id).toBe(req1.id + 1);
  });

  test('defaults params to empty object', () => {
    const req = buildRequest('ping');
    expect(req.params).toEqual({});
  });
});

describe('parseResponse', () => {
  test('extracts result on success', () => {
    const raw = {
      jsonrpc: '2.0',
      id: 1,
      result: { snapshot_id: 'abc', elements: [] },
    };
    expect(parseResponse(raw)).toEqual(raw.result);
  });

  test('throws ACError on error response', () => {
    const raw = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32001, message: 'Element not found', data: { ref: '@b99' } },
    };
    expect(() => parseResponse(raw)).toThrow(ACError);
    try {
      parseResponse(raw);
    } catch (e) {
      expect((e as ACError).code).toBe(-32001);
      expect((e as ACError).name).toBe('ELEMENT_NOT_FOUND');
    }
  });

  test('throws on null', () => {
    expect(() => parseResponse(null)).toThrow();
  });

  test('throws on undefined', () => {
    expect(() => parseResponse(undefined)).toThrow();
  });

  test('throws on missing jsonrpc field', () => {
    expect(() => parseResponse({ id: 1, result: {} })).toThrow(/jsonrpc/);
  });

  test('throws on missing id', () => {
    expect(() => parseResponse({ jsonrpc: '2.0', result: {} })).toThrow(/id/);
  });

  test('throws on missing both result and error', () => {
    expect(() => parseResponse({ jsonrpc: '2.0', id: 1 })).toThrow();
  });

  test('throws on non-object', () => {
    expect(() => parseResponse('string')).toThrow();
    expect(() => parseResponse(42)).toThrow();
  });
});
