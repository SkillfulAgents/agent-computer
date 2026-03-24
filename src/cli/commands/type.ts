import { registerCommand } from '../commands.js';
import { parseSelector } from '../parser.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('type', async (args: ParsedArgs, bridge: Bridge) => {
  const text = args.positional[0];
  if (!text) {
    return { data: { error: 'Usage: agent-computer type <text> [--delay ms]' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = { text };
  if (args.flags['delay']) params.delay = parseInt(args.flags['delay'] as string, 10);

  const result = await bridge.send('type', params);
  return { data: result, exitCode: 0 };
});

registerCommand('fill', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  const text = args.positional[1];
  if (!sel || !text) {
    return { data: { error: 'Usage: agent-computer fill <ref> <text>' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = { text };
  const parsed = parseSelector(sel);
  if (parsed.type === 'ref') {
    params.ref = parsed.ref;
  } else {
    params.ref = sel;
  }

  const result = await bridge.send('fill', params);
  return { data: result, exitCode: 0 };
});

registerCommand('key', async (args: ParsedArgs, bridge: Bridge) => {
  const combo = args.positional[0];
  if (!combo) {
    return { data: { error: 'Usage: agent-computer key <combo> [--repeat n]' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = { combo };
  if (args.flags['repeat']) params.repeat = parseInt(args.flags['repeat'] as string, 10);
  if (args.flags['delay']) params.delay = parseInt(args.flags['delay'] as string, 10);

  const result = await bridge.send('key', params);
  return { data: result, exitCode: 0 };
});

registerCommand('keydown', async (args: ParsedArgs, bridge: Bridge) => {
  const key = args.positional[0];
  if (!key) {
    return { data: { error: 'Usage: agent-computer keydown <key>' }, exitCode: 1 };
  }

  const result = await bridge.send('keydown', { key });
  return { data: result, exitCode: 0 };
});

registerCommand('keyup', async (args: ParsedArgs, bridge: Bridge) => {
  const key = args.positional[0];
  if (!key) {
    return { data: { error: 'Usage: agent-computer keyup <key>' }, exitCode: 1 };
  }

  const result = await bridge.send('keyup', { key });
  return { data: result, exitCode: 0 };
});

registerCommand('paste', async (args: ParsedArgs, bridge: Bridge) => {
  const text = args.positional[0];
  if (!text) {
    return { data: { error: 'Usage: agent-computer paste <text>' }, exitCode: 1 };
  }

  const result = await bridge.send('paste', { text });
  return { data: result, exitCode: 0 };
});
