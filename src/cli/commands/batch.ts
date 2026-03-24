import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('batch', async (args: ParsedArgs, bridge: Bridge) => {
  const jsonStr = args.positional[0] || args.subcommand;

  if (!jsonStr) {
    return { data: { error: 'Usage: agent-computer batch \'[["method", ...args], ...]\'' }, exitCode: 1 };
  }

  let commands: unknown[];
  try {
    commands = JSON.parse(jsonStr);
    if (!Array.isArray(commands)) throw new Error('not array');
  } catch {
    return { data: { error: 'Invalid JSON. Expected array of command arrays.' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = { commands };
  if (args.flags['no-stop-on-error']) params.stop_on_error = false;

  const result = await bridge.send('batch', params);
  return { data: result, exitCode: 0 };
});

registerCommand('changed', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = args.flags['app'];

  const result = await bridge.send('changed', params);
  return { data: result, exitCode: 0 };
});

registerCommand('diff', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = args.flags['app'];

  const result = await bridge.send('diff', params);
  return { data: result, exitCode: 0 };
});
