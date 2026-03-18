import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('snapshot', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  if (args.flags['interactive']) params.interactive = true;
  if (args.flags['compact']) params.compact = true;
  if (args.flags['depth']) params.depth = parseInt(args.flags['depth'] as string, 10);
  if (args.flags['subtree']) params.subtree = args.flags['subtree'];
  if (args.flags['app']) params.app = args.flags['app'];
  if (args.flags['pid']) params.pid = parseInt(args.flags['pid'] as string, 10);
  if (args.flags['screen']) params.screen = true;
  if (args.flags['window']) params.window = args.flags['window'];

  const result = await bridge.send('snapshot', params);
  return { data: result, exitCode: 0 };
});
