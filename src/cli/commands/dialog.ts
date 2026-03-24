import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('dialog', async (args: ParsedArgs, bridge: Bridge) => {
  const sub = args.subcommand;

  if (sub === 'accept' || sub === 'ok' || sub === 'yes') {
    const params: Record<string, unknown> = {};
    if (args.flags['app']) params.app = args.flags['app'];
    const result = await bridge.send('dialog_accept', params);
    return { data: result, exitCode: 0 };
  }

  if (sub === 'cancel' || sub === 'dismiss' || sub === 'no') {
    const params: Record<string, unknown> = {};
    if (args.flags['app']) params.app = args.flags['app'];
    const result = await bridge.send('dialog_cancel', params);
    return { data: result, exitCode: 0 };
  }

  if (sub === 'file') {
    const path = args.positional[0];
    if (!path) {
      return { data: { error: 'Usage: agent-computer dialog file <path>' }, exitCode: 1 };
    }
    const params: Record<string, unknown> = { path };
    if (args.flags['app']) params.app = args.flags['app'];
    const result = await bridge.send('dialog_file', params);
    return { data: result, exitCode: 0 };
  }

  // Default: detect dialog
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = args.flags['app'];
  const result = await bridge.send('dialog', params);
  return { data: result, exitCode: 0 };
});

registerCommand('alert', async (args: ParsedArgs, bridge: Bridge) => {
  // Alias for dialog
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = args.flags['app'];
  const result = await bridge.send('dialog', params);
  return { data: result, exitCode: 0 };
});
