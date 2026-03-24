#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_js_1 = require("../src/cli/parser.js");
const commands_js_1 = require("../src/cli/commands.js");
const output_js_1 = require("../src/cli/output.js");
const bridge_js_1 = require("../src/bridge.js");
const errors_js_1 = require("../src/errors.js");
const config_js_1 = require("../src/config.js");
async function main() {
    const parsed = (0, parser_js_1.parseArgs)(process.argv);
    const config = (0, config_js_1.resolveConfig)();
    // Resolve global options
    const jsonMode = parsed.flags['json'] === true || process.env.AC_JSON === '1';
    const textMode = !jsonMode;
    const verbose = parsed.flags['verbose'] === true || process.env.AC_VERBOSE === '1';
    const contentBoundary = parsed.flags['content-boundary'] === true || config['content-boundary'];
    const maxOutput = typeof parsed.flags['max-output'] === 'string'
        ? parseInt(parsed.flags['max-output'], 10)
        : undefined;
    const timeout = typeof parsed.flags['timeout'] === 'string'
        ? parseInt(parsed.flags['timeout'], 10)
        : config['default-timeout'];
    if (verbose) {
        process.env.AC_VERBOSE = '1';
    }
    // Special case: help outputs plain text
    if (parsed.command === 'help') {
        const handler = (0, commands_js_1.getCommand)('help');
        const result = await handler(parsed, null);
        console.log(result.data);
        process.exit(0);
    }
    // Find command handler
    const handler = await (0, commands_js_1.getCommandAsync)(parsed.command);
    if (!handler) {
        // Try sending as a raw method to the daemon
        const bridge = new bridge_js_1.Bridge({ timeout });
        try {
            const result = await bridge.send(parsed.command, buildParamsFromArgs(parsed));
            output(result, textMode, contentBoundary, maxOutput);
            await bridge.disconnect();
            process.exit(0);
        }
        catch (err) {
            if (err instanceof errors_js_1.ACError) {
                outputError(err, textMode);
                await bridge.disconnect();
                process.exit(err.exitCode);
            }
            console.error(`Unknown command: ${parsed.command}. Run 'agent-computer --help' for usage.`);
            await bridge.disconnect();
            process.exit(126);
        }
    }
    // Execute command
    const bridge = new bridge_js_1.Bridge({ timeout });
    try {
        const result = await handler(parsed, bridge);
        // Show hint (e.g., Chromium app warning) on stderr
        if (result.data && typeof result.data === 'object' && 'hint' in result.data) {
            const hint = result.data.hint;
            process.stderr.write(`\n⚠️  ${hint}\n\n`);
        }
        output(result.data, textMode, contentBoundary, maxOutput);
        await bridge.disconnect();
        process.exit(result.exitCode);
    }
    catch (err) {
        if (err instanceof errors_js_1.ACError) {
            outputError(err, textMode);
            await bridge.disconnect();
            process.exit(err.exitCode);
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error(textMode ? `Error: ${message}` : JSON.stringify({ error: message }));
        await bridge.disconnect();
        process.exit(126);
    }
}
function output(data, textMode, boundary, maxOutput) {
    let out;
    if (typeof data === 'string') {
        out = data;
    }
    else {
        out = (0, output_js_1.formatOutput)(data, textMode);
    }
    if (maxOutput) {
        out = (0, output_js_1.truncateOutput)(out, maxOutput);
    }
    if (boundary) {
        out = (0, output_js_1.wrapBoundary)(out);
    }
    console.log(out);
}
function outputError(err, textMode) {
    if (textMode) {
        console.error(`Error [${err.name}]: ${err.message}`);
    }
    else {
        console.error(JSON.stringify({
            error: {
                code: err.code,
                name: err.name,
                message: err.message,
                data: err.data,
            },
        }));
    }
}
function buildParamsFromArgs(parsed) {
    const params = { ...parsed.flags };
    if (parsed.positional.length > 0) {
        params._positional = parsed.positional;
        // Common pattern: first positional is a ref or selector
        params.ref = parsed.positional[0];
    }
    if (parsed.subcommand) {
        params._subcommand = parsed.subcommand;
    }
    return params;
}
main().catch((err) => {
    console.error(err);
    process.exit(126);
});
