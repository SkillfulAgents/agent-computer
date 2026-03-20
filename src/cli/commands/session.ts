import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('grab', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};

  if (args.flags['app']) {
    params.app = args.flags['app'];
  } else if (args.positional[0]) {
    const val = args.positional[0];
    if (val.startsWith('@')) {
      params.ref = val;
    } else {
      params.app = val;
    }
  } else {
    return { data: { error: 'Usage: ac grab <@w1> or ac grab --app <name>' }, exitCode: 1 };
  }

  const result = await bridge.send('grab', params);
  return { data: result, exitCode: 0 };
});

registerCommand('ungrab', async (_args: ParsedArgs, bridge: Bridge) => {
  const result = await bridge.send('ungrab');
  return { data: result, exitCode: 0 };
});
