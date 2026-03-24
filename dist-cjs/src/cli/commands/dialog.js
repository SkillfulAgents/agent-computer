"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('dialog', async (args, bridge) => {
    const sub = args.subcommand;
    if (sub === 'accept' || sub === 'ok' || sub === 'yes') {
        const params = {};
        if (args.flags['app'])
            params.app = args.flags['app'];
        const result = await bridge.send('dialog_accept', params);
        return { data: result, exitCode: 0 };
    }
    if (sub === 'cancel' || sub === 'dismiss' || sub === 'no') {
        const params = {};
        if (args.flags['app'])
            params.app = args.flags['app'];
        const result = await bridge.send('dialog_cancel', params);
        return { data: result, exitCode: 0 };
    }
    if (sub === 'file') {
        const path = args.positional[0];
        if (!path) {
            return { data: { error: 'Usage: agent-computer dialog file <path>' }, exitCode: 1 };
        }
        const params = { path };
        if (args.flags['app'])
            params.app = args.flags['app'];
        const result = await bridge.send('dialog_file', params);
        return { data: result, exitCode: 0 };
    }
    // Default: detect dialog
    const params = {};
    if (args.flags['app'])
        params.app = args.flags['app'];
    const result = await bridge.send('dialog', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('alert', async (args, bridge) => {
    // Alias for dialog
    const params = {};
    if (args.flags['app'])
        params.app = args.flags['app'];
    const result = await bridge.send('dialog', params);
    return { data: result, exitCode: 0 };
});
