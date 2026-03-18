import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('windows', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};
  if (args.flags['app']) params.app = args.flags['app'];
  const result = await bridge.send('windows', params);
  return { data: result, exitCode: 0 };
});
