"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
// Simple window actions: minimize, maximize, fullscreen, close, raise
for (const cmd of ['minimize', 'maximize', 'fullscreen', 'close', 'raise']) {
    (0, commands_js_1.registerCommand)(cmd, async (args, bridge) => {
        const ref = args.positional[0] || args.flags['ref'];
        const params = {};
        if (ref)
            params.ref = ref;
        const result = await bridge.send(cmd, params);
        return { data: result, exitCode: 0 };
    });
}
(0, commands_js_1.registerCommand)('move', async (args, bridge) => {
    const ref = args.positional[0];
    const x = args.positional[1];
    const y = args.positional[2];
    if (!ref) {
        return { data: { error: 'Usage: agent-computer move <@w> <x> <y>' }, exitCode: 1 };
    }
    const params = { ref };
    if (x !== undefined && y !== undefined) {
        params.x = parseFloat(x);
        params.y = parseFloat(y);
    }
    const result = await bridge.send('move', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('resize', async (args, bridge) => {
    const ref = args.positional[0];
    const w = args.positional[1];
    const h = args.positional[2];
    if (!ref) {
        return { data: { error: 'Usage: agent-computer resize <@w> <w> <h>' }, exitCode: 1 };
    }
    const params = { ref };
    if (w !== undefined && h !== undefined) {
        params.width = parseFloat(w);
        params.height = parseFloat(h);
    }
    const result = await bridge.send('resize', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('bounds', async (args, bridge) => {
    const ref = args.positional[0];
    if (!ref) {
        return { data: { error: 'Usage: agent-computer bounds <@w> <x> <y> <w> <h> | agent-computer bounds <@w> --preset <name>' }, exitCode: 1 };
    }
    const params = { ref };
    if (args.flags['preset']) {
        params.preset = args.flags['preset'];
    }
    else if (args.positional.length >= 5) {
        params.x = parseFloat(args.positional[1]);
        params.y = parseFloat(args.positional[2]);
        params.width = parseFloat(args.positional[3]);
        params.height = parseFloat(args.positional[4]);
    }
    const result = await bridge.send('bounds', params);
    return { data: result, exitCode: 0 };
});
