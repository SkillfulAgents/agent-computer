#!/usr/bin/env node

import { parseArgs, type ParsedArgs } from '../src/cli/parser.js';
import { getCommand } from '../src/cli/commands.js';
import { formatOutput, wrapBoundary, truncateOutput } from '../src/cli/output.js';
import { Bridge } from '../src/bridge.js';
import { ACError } from '../src/errors.js';
import { resolveConfig } from '../src/config.js';

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);
  const config = resolveConfig();

  // Resolve global options
  const textMode = parsed.flags['text'] === true || process.env.AC_TEXT === '1';
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
    const handler = getCommand('help')!;
    const result = await handler(parsed, null as any);
    console.log(result.data);
    process.exit(0);
  }

  // Find command handler
  const handler = getCommand(parsed.command);
  if (!handler) {
    // Try sending as a raw method to the daemon
    const bridge = new Bridge({ timeout });
    try {
      const result = await bridge.send(parsed.command, buildParamsFromArgs(parsed));
      output(result, textMode, contentBoundary, maxOutput);
      await bridge.disconnect();
      process.exit(0);
    } catch (err) {
      if (err instanceof ACError) {
        outputError(err, textMode);
        await bridge.disconnect();
        process.exit(err.exitCode);
      }
      console.error(`Unknown command: ${parsed.command}. Run 'ac --help' for usage.`);
      await bridge.disconnect();
      process.exit(126);
    }
  }

  // Execute command
  const bridge = new Bridge({ timeout });
  try {
    const result = await handler(parsed, bridge);
    output(result.data, textMode, contentBoundary, maxOutput);
    await bridge.disconnect();
    process.exit(result.exitCode);
  } catch (err) {
    if (err instanceof ACError) {
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

function output(data: unknown, textMode: boolean, boundary: boolean, maxOutput?: number): void {
  let out: string;
  if (typeof data === 'string') {
    out = data;
  } else {
    out = formatOutput(data, textMode);
  }

  if (maxOutput) {
    out = truncateOutput(out, maxOutput);
  }

  if (boundary) {
    out = wrapBoundary(out);
  }

  console.log(out);
}

function outputError(err: ACError, textMode: boolean): void {
  if (textMode) {
    console.error(`Error [${err.name}]: ${err.message}`);
  } else {
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

function buildParamsFromArgs(parsed: ParsedArgs): Record<string, unknown> {
  const params: Record<string, unknown> = { ...parsed.flags };
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
