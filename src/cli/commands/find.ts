import { registerCommand } from '../commands.js';
import { parseSelector } from '../parser.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('find', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  if (args.positional[0]) params.text = args.positional[0];
  if (args.flags['role']) params.role = args.flags['role'];
  if (args.flags['first']) params.first = true;
  if (args.flags['app']) params.app = args.flags['app'];

  const result = await bridge.send('find', params);
  return { data: result, exitCode: 0 };
});

registerCommand('read', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: agent-computer read <ref> [--attr <name>]' }, exitCode: 1 };
  }

  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;
  const params: Record<string, unknown> = { ref };
  if (args.flags['attr']) params.attr = args.flags['attr'];

  const result = await bridge.send('read', params);
  return { data: result, exitCode: 0 };
});

registerCommand('title', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = true;

  const result = await bridge.send('title', params);
  return { data: result, exitCode: 0 };
});

registerCommand('is', async (args: ParsedArgs, bridge: Bridge) => {
  const state = args.subcommand;
  const sel = args.positional[0];
  if (!state || !sel) {
    return { data: { error: 'Usage: agent-computer is <visible|enabled|focused|checked> <ref>' }, exitCode: 1 };
  }

  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('is', { state, ref });
  return { data: result, exitCode: 0 };
});

registerCommand('box', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: agent-computer box <ref>' }, exitCode: 1 };
  }
  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('box', { ref });
  return { data: result, exitCode: 0 };
});

registerCommand('children', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: agent-computer children <ref>' }, exitCode: 1 };
  }
  const parsed = parseSelector(sel);
  const ref = parsed.type === 'ref' ? parsed.ref : sel;

  const result = await bridge.send('children', { ref });
  return { data: result, exitCode: 0 };
});

registerCommand('wait', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  // Wait for fixed duration
  if (args.positional[0] && /^\d+$/.test(args.positional[0])) {
    params.ms = parseInt(args.positional[0], 10);
  } else if (args.positional[0]) {
    // Wait for element
    const parsed = parseSelector(args.positional[0]);
    if (parsed.type === 'ref') params.ref = parsed.ref;
    else params.ref = args.positional[0];
  }

  if (args.flags['app']) params.app = args.flags['app'];
  if (args.flags['window']) params.window = args.flags['window'];
  if (args.flags['text']) params.text = args.flags['text'];
  if (args.flags['hidden']) params.hidden = true;
  if (args.flags['enabled']) params.enabled = true;
  if (args.flags['gone']) params.gone = true;
  if (args.flags['timeout']) params.timeout = parseInt(args.flags['timeout'] as string, 10);

  const result = await bridge.send('wait', params);
  return { data: result, exitCode: 0 };
});
