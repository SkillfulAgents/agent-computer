import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('screenshot', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  // Optional output path as first positional arg
  if (args.positional[0]) params.path = args.positional[0];

  if (args.flags['screen']) params.screen = true;
  if (args.flags['retina']) params.retina = true;
  if (args.flags['format']) params.format = args.flags['format'];
  if (args.flags['quality']) params.quality = parseInt(args.flags['quality'] as string, 10);
  if (args.flags['window']) params.ref = args.flags['window'];
  if (args.flags['annotate']) params.annotate = true;

  const result = await bridge.send('screenshot', params);
  return { data: result, exitCode: 0 };
});

registerCommand('displays', async (_args: ParsedArgs, bridge: Bridge) => {
  const result = await bridge.send('displays');
  return { data: result, exitCode: 0 };
});
