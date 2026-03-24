"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IS_NAMED_PIPE = exports.SOCKET_PATH = exports.SNAPSHOTS_DIR = exports.DAEMON_JSON_PATH = exports.AC_DIR = void 0;
const path_1 = require("path");
const os_1 = require("os");
const os = (0, os_1.platform)();
exports.AC_DIR = (0, path_1.join)((0, os_1.homedir)(), '.ac');
exports.DAEMON_JSON_PATH = (0, path_1.join)(exports.AC_DIR, 'daemon.json');
exports.SNAPSHOTS_DIR = (0, path_1.join)(exports.AC_DIR, 'snapshots');
// macOS: Unix domain socket file on disk
// Windows: Named pipe (kernel object, no file on disk)
exports.SOCKET_PATH = os === 'win32'
    ? '\\\\.\\pipe\\ac-daemon'
    : (0, path_1.join)(exports.AC_DIR, 'daemon.sock');
// Named pipes don't exist as files — connection-based detection needed
exports.IS_NAMED_PIPE = os === 'win32';
