"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commands_js_1 = require("../commands.js");
(0, commands_js_1.registerCommand)('apps', async (args, bridge) => {
    const params = {};
    if (args.flags['running'])
        params.running = true;
    const result = await bridge.send('apps', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('launch', async (args, bridge) => {
    const name = args.positional[0];
    if (!name) {
        return { data: { error: 'Usage: agent-computer launch <name> [--wait] [--background]' }, exitCode: 1 };
    }
    const params = {
        name,
        wait: args.flags['wait'] === true,
        background: args.flags['background'] === true,
    };
    if (args.flags['open']) {
        params.open = args.flags['open'];
    }
    const result = await bridge.send('launch', params);
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('relaunch', async (args, bridge) => {
    const name = args.positional[0];
    if (!name) {
        return { data: { error: 'Usage: agent-computer relaunch <name>' }, exitCode: 1 };
    }
    const result = await bridge.send('relaunch', { name });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('quit', async (args, bridge) => {
    const name = args.positional[0];
    if (!name) {
        return { data: { error: 'Usage: agent-computer quit <name> [--force]' }, exitCode: 1 };
    }
    const result = await bridge.send('quit', { name, force: args.flags['force'] === true });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('hide', async (args, bridge) => {
    const name = args.positional[0];
    if (!name)
        return { data: { error: 'Usage: agent-computer hide <name>' }, exitCode: 1 };
    const result = await bridge.send('hide', { name });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('unhide', async (args, bridge) => {
    const name = args.positional[0];
    if (!name)
        return { data: { error: 'Usage: agent-computer unhide <name>' }, exitCode: 1 };
    const result = await bridge.send('unhide', { name });
    return { data: result, exitCode: 0 };
});
(0, commands_js_1.registerCommand)('switch', async (args, bridge) => {
    const name = args.positional[0];
    if (!name)
        return { data: { error: 'Usage: agent-computer switch <name>' }, exitCode: 1 };
    const result = await bridge.send('switch', { name });
    return { data: result, exitCode: 0 };
});
