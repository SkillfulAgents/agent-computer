import { registerCommand } from '../commands.js';
import { parseSelector } from '../parser.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('scroll', async (args: ParsedArgs, bridge: Bridge) => {
  const direction = args.subcommand;
  if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
    return { data: { error: 'Usage: ac scroll <up|down|left|right> [amount] [--on <sel>] [--smooth] [--pixels <n>]' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = { direction };

  if (args.positional[0]) params.amount = parseInt(args.positional[0], 10);
  if (args.flags['on']) params.on = args.flags['on'];
  if (args.flags['smooth']) params.smooth = true;
  if (args.flags['pixels']) params.pixels = parseInt(args.flags['pixels'] as string, 10);

  const result = await bridge.send('scroll', params);
  return { data: result, exitCode: 0 };
});

registerCommand('focus', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: ac focus <ref>' }, exitCode: 1 };
  }

  const parsed = parseSelector(sel);
  const params: Record<string, unknown> = {};
  if (parsed.type === 'ref') params.ref = parsed.ref;
  else params.ref = sel;

  const result = await bridge.send('focus', params);
  return { data: result, exitCode: 0 };
});

registerCommand('select', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  const value = args.positional[1];
  if (!sel || !value) {
    return { data: { error: 'Usage: ac select <ref> <value>' }, exitCode: 1 };
  }

  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('select', { ref, value });
  return { data: result, exitCode: 0 };
});

registerCommand('check', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: ac check <ref>' }, exitCode: 1 };
  }
  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('check', { ref });
  return { data: result, exitCode: 0 };
});

registerCommand('uncheck', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: ac uncheck <ref>' }, exitCode: 1 };
  }
  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('uncheck', { ref });
  return { data: result, exitCode: 0 };
});

registerCommand('set', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  const value = args.positional[1];
  if (!sel || value === undefined) {
    return { data: { error: 'Usage: ac set <ref> <value>' }, exitCode: 1 };
  }
  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('set', { ref, value });
  return { data: result, exitCode: 0 };
});
