import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('drag', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  // Support ref-based: ac drag @b1 @b2
  // Or coordinate-based: ac drag --from-x 100 --from-y 200 --to-x 300 --to-y 400
  if (args.positional[0]) params.from_ref = args.positional[0];
  if (args.positional[1]) params.to_ref = args.positional[1];

  if (args.flags['from-x']) params.from_x = parseFloat(args.flags['from-x'] as string);
  if (args.flags['from-y']) params.from_y = parseFloat(args.flags['from-y'] as string);
  if (args.flags['to-x']) params.to_x = parseFloat(args.flags['to-x'] as string);
  if (args.flags['to-y']) params.to_y = parseFloat(args.flags['to-y'] as string);
  if (args.flags['duration']) params.duration = parseFloat(args.flags['duration'] as string);
  if (args.flags['steps']) params.steps = parseInt(args.flags['steps'] as string, 10);

  const result = await bridge.send('drag', params);
  return { data: result, exitCode: 0 };
});
