"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
const parser_js_1 = require("../parser.js");
(0, commands_js_1.registerCommand)('type', async (args, bridge) => {
    const text = args.positional[0];
    if (!text) {
        return { data: { error: 'Usage: agent-computer type <text> [--delay ms]' }, exitCode: 1 };
    }
    const params = { text };
    if (args.flags['delay'])
        params.delay = parseInt(args.flags['delay'], 10);
    const result = await bridge.send('type', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('fill', async (args, bridge) => {
    const sel = args.positional[0];
    const text = args.positional[1];
    if (!sel || !text) {
        return { data: { error: 'Usage: agent-computer fill <ref> <text>' }, exitCode: 1 };
    }
    const params = { text };
    const parsed = (0, parser_js_1.parseSelector)(sel);
    if (parsed.type === 'ref') {
        params.ref = parsed.ref;
    }
    else {
        params.ref = sel;
    }
    const result = await bridge.send('fill', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('key', async (args, bridge) => {
    const combo = args.positional[0];
    if (!combo) {
        return { data: { error: 'Usage: agent-computer key <combo> [--repeat n]' }, exitCode: 1 };
    }
    const params = { combo };
    if (args.flags['repeat'])
        params.repeat = parseInt(args.flags['repeat'], 10);
    if (args.flags['delay'])
        params.delay = parseInt(args.flags['delay'], 10);
    const result = await bridge.send('key', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('keydown', async (args, bridge) => {
    const key = args.positional[0];
    if (!key) {
        return { data: { error: 'Usage: agent-computer keydown <key>' }, exitCode: 1 };
    }
    const result = await bridge.send('keydown', { key });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('keyup', async (args, bridge) => {
    const key = args.positional[0];
    if (!key) {
        return { data: { error: 'Usage: agent-computer keyup <key>' }, exitCode: 1 };
    }
    const result = await bridge.send('keyup', { key });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('paste', async (args, bridge) => {
    const text = args.positional[0];
    if (!text) {
        return { data: { error: 'Usage: agent-computer paste <text>' }, exitCode: 1 };
    }
    const result = await bridge.send('paste', { text });
    return { data: result, exitCode: 0 };
});
