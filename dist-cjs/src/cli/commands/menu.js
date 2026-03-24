"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('menu', async (args, bridge) => {
    const sub = args.subcommand;
    if (sub === 'list') {
        // ac menu list [name] [--all] [--app name]
        const params = {};
        if (args.positional[0])
            params.menu = args.positional[0];
        if (args.flags['all'])
            params.all = true;
        if (args.flags['app'])
            params.app = args.flags['app'];
        const result = await bridge.send('menu_list', params);
        return { data: result, exitCode: 0 };
    }
    if (sub) {
        // ac menu "File > Save" — click by path
        const params = { path: sub };
        if (args.flags['app'])
            params.app = args.flags['app'];
        const result = await bridge.send('menu_click', params);
        return { data: result, exitCode: 0 };
    }
    return { data: { error: 'Usage: agent-computer menu <path> | agent-computer menu list [name]' }, exitCode: 1 };
});
(0, commands_js_1.registerCommand)('menubar', async (args, bridge) => {
    const sub = args.subcommand;
    if (sub === 'click' && args.positional[0]) {
        // Click a menubar extra — not fully implemented yet
        return { data: { error: 'menubar click not yet implemented' }, exitCode: 1 };
    }
    const result = await bridge.send('menubar');
    return { data: result, exitCode: 0 };
});
