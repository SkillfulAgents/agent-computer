"use strict";
// @skillful-agents/ac — TypeScript SDK for macOS desktop automation
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPInteractions = exports.CDPAXTree = exports.CDPConnection = exports.CDPClient = exports.AC = exports.Bridge = exports.TimeoutError = exports.PermissionDeniedError = exports.ElementNotFoundError = exports.ACError = exports.REF_PREFIXES = exports.refToRole = exports.isValidRef = exports.parseRef = void 0;
var refs_js_1 = require("./refs.js");
Object.defineProperty(exports, "parseRef", { enumerable: true, get: function () { return refs_js_1.parseRef; } });
Object.defineProperty(exports, "isValidRef", { enumerable: true, get: function () { return refs_js_1.isValidRef; } });
Object.defineProperty(exports, "refToRole", { enumerable: true, get: function () { return refs_js_1.refToRole; } });
Object.defineProperty(exports, "REF_PREFIXES", { enumerable: true, get: function () { return refs_js_1.REF_PREFIXES; } });
var errors_js_1 = require("./errors.js");
Object.defineProperty(exports, "ACError", { enumerable: true, get: function () { return errors_js_1.ACError; } });
Object.defineProperty(exports, "ElementNotFoundError", { enumerable: true, get: function () { return errors_js_1.ElementNotFoundError; } });
Object.defineProperty(exports, "PermissionDeniedError", { enumerable: true, get: function () { return errors_js_1.PermissionDeniedError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return errors_js_1.TimeoutError; } });
var bridge_js_1 = require("./bridge.js");
Object.defineProperty(exports, "Bridge", { enumerable: true, get: function () { return bridge_js_1.Bridge; } });
var sdk_js_1 = require("./sdk.js");
Object.defineProperty(exports, "AC", { enumerable: true, get: function () { return sdk_js_1.AC; } });
// CDP support
var index_js_1 = require("./cdp/index.js");
Object.defineProperty(exports, "CDPClient", { enumerable: true, get: function () { return index_js_1.CDPClient; } });
Object.defineProperty(exports, "CDPConnection", { enumerable: true, get: function () { return index_js_1.CDPConnection; } });
Object.defineProperty(exports, "CDPAXTree", { enumerable: true, get: function () { return index_js_1.CDPAXTree; } });
Object.defineProperty(exports, "CDPInteractions", { enumerable: true, get: function () { return index_js_1.CDPInteractions; } });
