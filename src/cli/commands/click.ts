import { registerCommand } from '../commands.js';
import { parseSelector } from '../parser.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('click', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: ac click <ref|x,y|label> [--right] [--double] [--count N] [--modifiers keys]' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = {};
  const parsed = parseSelector(sel);

  if (parsed.type === 'ref') {
    params.ref = parsed.ref;
  } else if (parsed.type === 'coords') {
    params.x = parsed.x;
    params.y = parsed.y;
  } else {
    // Label-based click — not yet implemented, pass as ref for now
    params.ref = parsed.label;
  }

  if (args.flags['right']) params.right = true;
  if (args.flags['double']) params.double = true;
  if (args.flags['count']) params.count = parseInt(args.flags['count'] as string, 10);
  if (args.flags['modifiers']) {
    const mods = args.flags['modifiers'] as string;
    params.modifiers = mods.split(',').map(m => m.trim());
  }
  if (args.flags['wait']) params.wait = true;
  if (args.flags['human']) params.human = true;

  const result = await bridge.send('click', params);
  return { data: result, exitCode: 0 };
});

registerCommand('hover', async (args: ParsedArgs, bridge: Bridge) => {
  const sel = args.positional[0];
  if (!sel) {
    return { data: { error: 'Usage: ac hover <ref|x,y>' }, exitCode: 1 };
  }

  const params: Record<string, unknown> = {};
  const parsed = parseSelector(sel);

  if (parsed.type === 'ref') {
    params.ref = parsed.ref;
  } else if (parsed.type === 'coords') {
    params.x = parsed.x;
    params.y = parsed.y;
  } else {
    params.ref = parsed.label;
  }

  if (args.flags['human']) params.human = true;

  const result = await bridge.send('hover', params);
  return { data: result, exitCode: 0 };
});
