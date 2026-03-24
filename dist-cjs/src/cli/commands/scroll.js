"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
const parser_js_1 = require("../parser.js");
(0, commands_js_1.registerCommand)('scroll', async (args, bridge) => {
    const direction = args.subcommand;
    if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
        return { data: { error: 'Usage: agent-computer scroll <up|down|left|right> [amount] [--on <sel>] [--smooth] [--pixels <n>]' }, exitCode: 1 };
    }
    const params = { direction };
    if (args.positional[0])
        params.amount = parseInt(args.positional[0], 10);
    if (args.flags['on'])
        params.on = args.flags['on'];
    if (args.flags['smooth'])
        params.smooth = true;
    if (args.flags['pixels'])
        params.pixels = parseInt(args.flags['pixels'], 10);
    const result = await bridge.send('scroll', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('focus', async (args, bridge) => {
    const sel = args.positional[0];
    if (!sel) {
        return { data: { error: 'Usage: agent-computer focus <ref>' }, exitCode: 1 };
    }
    const parsed = (0, parser_js_1.parseSelector)(sel);
    const params = {};
    if (parsed.type === 'ref')
        params.ref = parsed.ref;
    else
        params.ref = sel;
    const result = await bridge.send('focus', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('select', async (args, bridge) => {
    const sel = args.positional[0];
    const value = args.positional[1];
    if (!sel || !value) {
        return { data: { error: 'Usage: agent-computer select <ref> <value>' }, exitCode: 1 };
    }
    const parsed = (0, parser_js_1.parseSelector)(sel);
    const ref = parsed.type === 'ref' ? parsed.ref : sel;
    const result = await bridge.send('select', { ref, value });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('check', async (args, bridge) => {
    const sel = args.positional[0];
    if (!sel) {
        return { data: { error: 'Usage: agent-computer check <ref>' }, exitCode: 1 };
    }
    const parsed = (0, parser_js_1.parseSelector)(sel);
    const ref = parsed.type === 'ref' ? parsed.ref : sel;
    const result = await bridge.send('check', { ref });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('uncheck', async (args, bridge) => {
    const sel = args.positional[0];
    if (!sel) {
        return { data: { error: 'Usage: agent-computer uncheck <ref>' }, exitCode: 1 };
    }
    const parsed = (0, parser_js_1.parseSelector)(sel);
    const ref = parsed.type === 'ref' ? parsed.ref : sel;
    const result = await bridge.send('uncheck', { ref });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('set', async (args, bridge) => {
    const sel = args.positional[0];
    const value = args.positional[1];
    if (!sel || value === undefined) {
        return { data: { error: 'Usage: agent-computer set <ref> <value>' }, exitCode: 1 };
    }
    const parsed = (0, parser_js_1.parseSelector)(sel);
    const ref = parsed.type === 'ref' ? parsed.ref : sel;
    const result = await bridge.send('set', { ref, value });
    return { data: result, exitCode: 0 };
});
