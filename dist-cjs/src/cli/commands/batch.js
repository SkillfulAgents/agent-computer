"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('batch', async (args, bridge) => {
    const jsonStr = args.positional[0] || args.subcommand;
    if (!jsonStr) {
        return { data: { error: 'Usage: agent-computer batch \'[["method", ...args], ...]\'' }, exitCode: 1 };
    }
    let commands;
    try {
        commands = JSON.parse(jsonStr);
        if (!Array.isArray(commands))
            throw new Error('not array');
    }
    catch {
        return { data: { error: 'Invalid JSON. Expected array of command arrays.' }, exitCode: 1 };
    }
    const params = { commands };
    if (args.flags['no-stop-on-error'])
        params.stop_on_error = false;
    const result = await bridge.send('batch', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('changed', async (args, bridge) => {
    const params = {};
    if (args.flags['app'])
        params.app = args.flags['app'];
    const result = await bridge.send('changed', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('diff', async (args, bridge) => {
    const params = {};
    if (args.flags['app'])
        params.app = args.flags['app'];
    const result = await bridge.send('diff', params);
    return { data: result, exitCode: 0 };
});
