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
exports.discoverTargets = discoverTargets;
exports.findPageTarget = findPageTarget;
exports.waitForCDP = waitForCDP;
const http = __importStar(require("http"));
/** GET http://localhost:{port}/json/list — returns all CDP targets */
async function discoverTargets(port) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk.toString(); });
            res.on('end', () => {
                try {
                    const targets = JSON.parse(data);
                    resolve(targets);
                }
                catch (err) {
                    reject(new Error(`Failed to parse CDP targets: ${err}`));
                }
            });
        });
        req.on('error', (err) => {
            reject(new Error(`Failed to discover CDP targets on port ${port}: ${err.message}`));
        });
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error(`CDP discovery timed out on port ${port}`));
        });
    });
}
/** Filter targets for type === 'page' and return first match */
async function findPageTarget(port) {
    const targets = await discoverTargets(port);
    const page = targets.find(t => t.type === 'page');
    if (!page) {
        throw new Error(`No page target found on port ${port}. Found: ${targets.map(t => t.type).join(', ')}`);
    }
    return page;
}
/** Poll until a page target appears, with timeout */
async function waitForCDP(port, timeout = 10000) {
    const start = Date.now();
    let lastError;
    while (Date.now() - start < timeout) {
        try {
            return await findPageTarget(port);
        }
        catch (err) {
            lastError = err;
            await sleep(200);
        }
    }
    throw new Error(`CDP not available on port ${port} after ${timeout}ms: ${lastError?.message}`);
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
