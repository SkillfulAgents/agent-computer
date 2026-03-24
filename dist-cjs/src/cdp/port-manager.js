"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findFreePort = findFreePort;
const net = __importStar(require("net"));
const PORT_RANGE_START = 19200;
const PORT_RANGE_END = 19299;
/** Find a free port in the CDP range by probing for one not in use. */
async function findFreePort() {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error(`No available CDP ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
}
/** Check if a port is available by attempting a TCP connection */
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(500);
        socket.on('connect', () => {
            socket.destroy();
            resolve(false); // Port is in use
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(true); // Timeout = nothing listening = available
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(true); // Connection refused = available
        });
        socket.connect(port, '127.0.0.1');
    });
}
