export class ACError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly exitCode: number,
    public readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ACError';
  }
}

export class ElementNotFoundError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32001, 1, data);
    this.name = 'ELEMENT_NOT_FOUND';
  }
}

export class PermissionDeniedError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32002, 2, data);
    this.name = 'PERMISSION_DENIED';
  }
}

export class TimeoutError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32003, 3, data);
    this.name = 'TIMEOUT';
  }
}

export class AppNotFoundError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32004, 4, data);
    this.name = 'APP_NOT_FOUND';
  }
}

export class WindowNotFoundError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32005, 5, data);
    this.name = 'WINDOW_NOT_FOUND';
  }
}

export class InvalidRefError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32006, 6, data);
    this.name = 'INVALID_REF';
  }
}

export class OCRFallbackFailedError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32007, 7, data);
    this.name = 'OCR_FALLBACK_FAILED';
  }
}

// JSON-RPC standard errors
export class InvalidRequestError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32600, 126, data);
    this.name = 'INVALID_REQUEST';
  }
}

export class MethodNotFoundError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32601, 126, data);
    this.name = 'METHOD_NOT_FOUND';
  }
}

export class InvalidParamsError extends ACError {
  constructor(message: string, data?: Record<string, unknown>) {
    super(message, -32602, 126, data);
    this.name = 'INVALID_PARAMS';
  }
}

// Error code → error class mapping
const ERROR_MAP: Record<number, new (msg: string, data?: Record<string, unknown>) => ACError> = {
  [-32001]: ElementNotFoundError,
  [-32002]: PermissionDeniedError,
  [-32003]: TimeoutError,
  [-32004]: AppNotFoundError,
  [-32005]: WindowNotFoundError,
  [-32006]: InvalidRefError,
  [-32007]: OCRFallbackFailedError,
  [-32600]: InvalidRequestError,
  [-32601]: MethodNotFoundError,
  [-32602]: InvalidParamsError,
};

export function errorFromCode(code: number, message: string, data?: Record<string, unknown>): ACError {
  const ErrorClass = ERROR_MAP[code];
  if (ErrorClass) {
    return new ErrorClass(message, data);
  }
  return new ACError(message, code, 126, data);
}

export function exitCodeFromErrorCode(code: number): number {
  const instance = ERROR_MAP[code];
  if (instance) {
    // Create a temporary instance to get the exit code
    const temp = new instance('');
    return temp.exitCode;
  }
  return 126;
}
