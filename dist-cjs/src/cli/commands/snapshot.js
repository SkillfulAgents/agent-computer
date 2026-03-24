"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('snapshot', async (args, bridge) => {
    const params = {};
    if (args.flags['interactive'])
        params.interactive = true;
    if (args.flags['compact'])
        params.compact = true;
    if (args.flags['depth'])
        params.depth = parseInt(args.flags['depth'], 10);
    if (args.flags['subtree'])
        params.subtree = args.flags['subtree'];
    if (args.flags['app'])
        params.app = args.flags['app'];
    if (args.flags['pid'])
        params.pid = parseInt(args.flags['pid'], 10);
    if (args.flags['screen'])
        params.screen = true;
    if (args.flags['window'])
        params.window = args.flags['window'];
    const result = await bridge.send('snapshot', params);
    return { data: result, exitCode: 0 };
});
