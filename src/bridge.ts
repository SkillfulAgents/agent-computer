import { errorFromCode, ACError } from './errors.js';

let nextId = 1;

export interface RPCRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface RPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

export function buildRequest(method: string, params: Record<string, unknown> = {}): RPCRequest {
  return {
    jsonrpc: '2.0',
    id: nextId++,
    method,
    params,
  };
}

export function parseResponse(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new Error('Invalid JSON-RPC response: expected an object');
  }

  const resp = raw as Record<string, unknown>;

  if (resp.jsonrpc !== '2.0') {
    throw new Error('Invalid JSON-RPC response: missing or incorrect "jsonrpc" field');
  }

  if (!('id' in resp)) {
    throw new Error('Invalid JSON-RPC response: missing "id" field');
  }

  if ('error' in resp && resp.error) {
    const err = resp.error as { code: number; message: string; data?: Record<string, unknown> };
    throw errorFromCode(err.code, err.message, err.data);
  }

  if ('result' in resp) {
    return resp.result;
  }

  throw new Error('Invalid JSON-RPC response: missing both "result" and "error"');
}

// Reset ID counter (for testing)
export function _resetIdCounter(): void {
  nextId = 1;
}
