"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('windows', async (args, bridge) => {
    const params = {};
    if (args.flags['app'])
        params.app = args.flags['app'];
    const result = await bridge.send('windows', params);
    return { data: result, exitCode: 0 };
});
