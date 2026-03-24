"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('grab', async (args, bridge) => {
    const params = {};
    if (args.flags['app']) {
        params.app = args.flags['app'];
    }
    else if (args.positional[0]) {
        const val = args.positional[0];
        if (val.startsWith('@')) {
            params.ref = val;
        }
        else {
            params.app = val;
        }
    }
    else {
        return { data: { error: 'Usage: agent-computer grab <@w1> or agent-computer grab --app <name>' }, exitCode: 1 };
    }
    const result = await bridge.send('grab', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('ungrab', async (_args, bridge) => {
    const result = await bridge.send('ungrab');
    return { data: result, exitCode: 0 };
});
