"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('screenshot', async (args, bridge) => {
    const params = {};
    // Optional output path as first positional arg
    if (args.positional[0])
        params.path = args.positional[0];
    if (args.flags['screen'])
        params.screen = true;
    if (args.flags['retina'])
        params.retina = true;
    if (args.flags['format'])
        params.format = args.flags['format'];
    if (args.flags['quality'])
        params.quality = parseInt(args.flags['quality'], 10);
    if (args.flags['window'])
        params.ref = args.flags['window'];
    if (args.flags['annotate'])
        params.annotate = true;
    const result = await bridge.send('screenshot', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('displays', async (_args, bridge) => {
    const result = await bridge.send('displays');
    return { data: result, exitCode: 0 };
});
