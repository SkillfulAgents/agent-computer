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
exports.registerCommand = registerCommand;
exports.getCommand = getCommand;
exports.getCommandAsync = getCommandAsync;
exports.getAllCommands = getAllCommands;
const daemon_js_1 = require("../daemon.js");
const config_js_1 = require("../config.js");
const completions_js_1 = require("./completions.js");
const commands = {};
let commandModulesLoaded = false;
function registerCommand(name, handler) {
    commands[name] = handler;
}
async function ensureCommandModulesLoaded() {
    if (commandModulesLoaded)
        return;
    commandModulesLoaded = true;
    await Promise.resolve().then(() => __importStar(require('./commands/apps.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/windows.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/session.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/snapshot.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/click.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/type.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/clipboard.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/windowmgmt.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/screenshot.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/scroll.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/find.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/menu.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/dialog.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/drag.js')));
    await Promise.resolve().then(() => __importStar(require('./commands/batch.js')));
}
function getCommand(name) {
    return commands[name];
}
async function getCommandAsync(name) {
    await ensureCommandModulesLoaded();
    return commands[name];
}
function getAllCommands() {
    return Object.keys(commands).sort();
}
// Register built-in commands
registerCommand('version', async () => {
    return { data: { version: '0.1.0' }, exitCode: 0 };
});
registerCommand('help', async () => {
    const help = `agent-computer — Agent Computer CLI for macOS

Usage: agent-computer <command> [options]

Commands:
  snapshot              Snapshot the accessibility tree
  screenshot [path]     Take a screenshot
  click <sel>           Click an element
  type <text>           Type text
  fill <sel> <text>     Focus, clear, and type into an element
  key <combo>           Press a key combination
  find <text>           Find elements by text
  read <sel>            Read element value
  scroll <dir> [amount] Scroll in a direction
  menu <path>           Click a menu item by path

  apps                  List applications
  launch <name>         Launch an application
  quit <name>           Quit an application
  windows               List windows
  grab <sel>            Set active window context
  ungrab                Clear active window context
  status                Show session state

  wait <sel|ms>         Wait for condition
  clipboard [set <text>] Clipboard operations
  alert                 Handle alerts
  dialog                Handle dialogs

  daemon <start|stop|status|restart>  Manage daemon
  config [set <key> <val> | reset]    Configuration
  permissions [grant]                 Permission status
  doctor                              Run diagnostics
  completion <bash|zsh>               Shell completion script
  version                             Print version

Global options:
  --json                JSON output (default: human-readable text)
  --timeout <ms>        Override timeout (default: 10000)
  --verbose             Debug logging to stderr
  --content-boundary    Wrap output in delimiters
  --max-output <n>      Truncate output to N characters

See: https://github.com/datawizz/agent-computer`;
    return { data: help, exitCode: 0 };
});
registerCommand('daemon', async (args) => {
    const manager = new daemon_js_1.DaemonManager();
    const sub = args.subcommand;
    switch (sub) {
        case 'start': {
            const status = await manager.start();
            return { data: status, exitCode: 0 };
        }
        case 'stop': {
            await manager.stop();
            return { data: { ok: true }, exitCode: 0 };
        }
        case 'status': {
            const status = await manager.status();
            return { data: status, exitCode: 0 };
        }
        case 'restart': {
            const status = await manager.restart();
            return { data: status, exitCode: 0 };
        }
        default:
            return { data: { error: `Unknown daemon subcommand: ${sub}. Use: start, stop, status, restart` }, exitCode: 1 };
    }
});
registerCommand('config', async (args) => {
    const sub = args.subcommand;
    switch (sub) {
        case 'set': {
            const key = args.positional[0];
            const value = args.positional[1];
            if (!key || value === undefined) {
                return { data: { error: 'Usage: agent-computer config set <key> <value>' }, exitCode: 1 };
            }
            const defaults = (0, config_js_1.getDefaults)();
            if (!(key in defaults)) {
                return { data: { error: `Unknown config key: ${key}` }, exitCode: 1 };
            }
            // Coerce value to correct type
            const defaultVal = defaults[key];
            let coerced = value;
            if (typeof defaultVal === 'number')
                coerced = parseInt(value, 10);
            if (typeof defaultVal === 'boolean')
                coerced = value === 'true' || value === '1';
            (0, config_js_1.setConfigValue)(key, coerced);
            return { data: { ok: true, key, value: coerced }, exitCode: 0 };
        }
        case 'reset': {
            (0, config_js_1.resetConfig)();
            return { data: { ok: true }, exitCode: 0 };
        }
        default: {
            // Show current config
            const config = (0, config_js_1.resolveConfig)();
            return { data: config, exitCode: 0 };
        }
    }
});
registerCommand('ping', async (_args, bridge) => {
    const result = await bridge.send('ping');
    return { data: result, exitCode: 0 };
});
registerCommand('status', async (_args, bridge) => {
    const result = await bridge.send('status');
    return { data: result, exitCode: 0 };
});
registerCommand('permissions', async (args, bridge) => {
    if (args.subcommand === 'grant') {
        const result = await bridge.send('permissions_grant');
        return { data: result, exitCode: 0 };
    }
    const result = await bridge.send('permissions');
    return { data: result, exitCode: 0 };
});
registerCommand('completion', async (args) => {
    const arg = args.positional[0] || 'install';
    if (arg === 'install') {
        const result = (0, completions_js_1.installCompletions)();
        return { data: result, exitCode: 0 };
    }
    if (arg === 'zsh') {
        return { data: (0, completions_js_1.generateZshCompletion)(), exitCode: 0 };
    }
    if (arg === 'bash') {
        return { data: (0, completions_js_1.generateBashCompletion)(), exitCode: 0 };
    }
    return { data: `Unknown: ${arg}. Use: install, bash, zsh`, exitCode: 1 };
});
registerCommand('doctor', async (_args, bridge) => {
    const [permissions, version, daemonStatus] = await Promise.all([
        bridge.send('permissions'),
        bridge.send('version'),
        new daemon_js_1.DaemonManager().status(),
    ]);
    const result = {
        version: version.version,
        permissions,
        daemon: daemonStatus,
        platform: process.platform,
        arch: process.arch,
    };
    return { data: result, exitCode: 0 };
});
