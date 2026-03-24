"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidParamsError = exports.MethodNotFoundError = exports.InvalidRequestError = exports.OCRFallbackFailedError = exports.InvalidRefError = exports.WindowNotFoundError = exports.AppNotFoundError = exports.TimeoutError = exports.PermissionDeniedError = exports.ElementNotFoundError = exports.ACError = void 0;
exports.errorFromCode = errorFromCode;
exports.exitCodeFromErrorCode = exitCodeFromErrorCode;
class ACError extends Error {
    code;
    exitCode;
    data;
    constructor(message, code, exitCode, data) {
        super(message);
        this.code = code;
        this.exitCode = exitCode;
        this.data = data;
        this.name = 'ACError';
    }
}
exports.ACError = ACError;
class ElementNotFoundError extends ACError {
    constructor(message, data) {
        super(message, -32001, 1, data);
        this.name = 'ELEMENT_NOT_FOUND';
    }
}
exports.ElementNotFoundError = ElementNotFoundError;
class PermissionDeniedError extends ACError {
    constructor(message, data) {
        super(message, -32002, 2, data);
        this.name = 'PERMISSION_DENIED';
    }
}
exports.PermissionDeniedError = PermissionDeniedError;
class TimeoutError extends ACError {
    constructor(message, data) {
        super(message, -32003, 3, data);
        this.name = 'TIMEOUT';
    }
}
exports.TimeoutError = TimeoutError;
class AppNotFoundError extends ACError {
    constructor(message, data) {
        super(message, -32004, 4, data);
        this.name = 'APP_NOT_FOUND';
    }
}
exports.AppNotFoundError = AppNotFoundError;
class WindowNotFoundError extends ACError {
    constructor(message, data) {
        super(message, -32005, 5, data);
        this.name = 'WINDOW_NOT_FOUND';
    }
}
exports.WindowNotFoundError = WindowNotFoundError;
class InvalidRefError extends ACError {
    constructor(message, data) {
        super(message, -32006, 6, data);
        this.name = 'INVALID_REF';
    }
}
exports.InvalidRefError = InvalidRefError;
class OCRFallbackFailedError extends ACError {
    constructor(message, data) {
        super(message, -32007, 7, data);
        this.name = 'OCR_FALLBACK_FAILED';
    }
}
exports.OCRFallbackFailedError = OCRFallbackFailedError;
// JSON-RPC standard errors
class InvalidRequestError extends ACError {
    constructor(message, data) {
        super(message, -32600, 126, data);
        this.name = 'INVALID_REQUEST';
    }
}
exports.InvalidRequestError = InvalidRequestError;
class MethodNotFoundError extends ACError {
    constructor(message, data) {
        super(message, -32601, 126, data);
        this.name = 'METHOD_NOT_FOUND';
    }
}
exports.MethodNotFoundError = MethodNotFoundError;
class InvalidParamsError extends ACError {
    constructor(message, data) {
        super(message, -32602, 126, data);
        this.name = 'INVALID_PARAMS';
    }
}
exports.InvalidParamsError = InvalidParamsError;
// Error code → error class mapping
const ERROR_MAP = {
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
function errorFromCode(code, message, data) {
    const ErrorClass = ERROR_MAP[code];
    if (ErrorClass) {
        return new ErrorClass(message, data);
    }
    return new ACError(message, code, 126, data);
}
function exitCodeFromErrorCode(code) {
    const instance = ERROR_MAP[code];
    if (instance) {
        // Create a temporary instance to get the exit code
        const temp = new instance('');
        return temp.exitCode;
    }
    return 126;
}
