"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('drag', async (args, bridge) => {
    const params = {};
    // Support ref-based: ac drag @b1 @b2
    // Or coordinate-based: ac drag --from-x 100 --from-y 200 --to-x 300 --to-y 400
    if (args.positional[0])
        params.from_ref = args.positional[0];
    if (args.positional[1])
        params.to_ref = args.positional[1];
    if (args.flags['from-x'])
        params.from_x = parseFloat(args.flags['from-x']);
    if (args.flags['from-y'])
        params.from_y = parseFloat(args.flags['from-y']);
    if (args.flags['to-x'])
        params.to_x = parseFloat(args.flags['to-x']);
    if (args.flags['to-y'])
        params.to_y = parseFloat(args.flags['to-y']);
    if (args.flags['duration'])
        params.duration = parseFloat(args.flags['duration']);
    if (args.flags['steps'])
        params.steps = parseInt(args.flags['steps'], 10);
    const result = await bridge.send('drag', params);
    return { data: result, exitCode: 0 };
});
