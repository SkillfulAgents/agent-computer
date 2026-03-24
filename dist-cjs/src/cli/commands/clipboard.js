"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('clipboard', async (args, bridge) => {
    const sub = args.subcommand;
    switch (sub) {
        case 'set': {
            const text = args.positional[0];
            if (!text) {
                return { data: { error: 'Usage: agent-computer clipboard set <text>' }, exitCode: 1 };
            }
            const result = await bridge.send('clipboard_set', { text });
            return { data: result, exitCode: 0 };
        }
        case 'copy': {
            const result = await bridge.send('clipboard_copy');
            return { data: result, exitCode: 0 };
        }
        case 'paste': {
            const result = await bridge.send('paste', { text: '' });
            // Actually clipboard paste is just Cmd+V
            const pasteResult = await bridge.send('key', { combo: 'cmd+v' });
            return { data: pasteResult, exitCode: 0 };
        }
        default: {
            // Read clipboard
            const result = await bridge.send('clipboard_read');
            return { data: result, exitCode: 0 };
        }
    }
});
