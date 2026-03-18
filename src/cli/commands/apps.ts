import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('apps', async (args: ParsedArgs, bridge: Bridge) => {
  const params: Record<string, unknown> = {};
  if (args.flags['running']) params.running = true;
  const result = await bridge.send('apps', params);
  return { data: result, exitCode: 0 };
});

registerCommand('launch', async (args: ParsedArgs, bridge: Bridge) => {
  const name = args.positional[0];
  if (!name) {
    return { data: { error: 'Usage: ac launch <name> [--wait] [--background]' }, exitCode: 1 };
  }
  const params: Record<string, unknown> = {
    name,
    wait: args.flags['wait'] === true,
    background: args.flags['background'] === true,
  };
  if (args.flags['open']) {
    params.open = args.flags['open'];
  }
  const result = await bridge.send('launch', params);
  return { data: result, exitCode: 0 };
});

registerCommand('quit', async (args: ParsedArgs, bridge: Bridge) => {
  const name = args.positional[0];
  if (!name) {
    return { data: { error: 'Usage: ac quit <name> [--force]' }, exitCode: 1 };
  }
  const result = await bridge.send('quit', { name, force: args.flags['force'] === true });
  return { data: result, exitCode: 0 };
});

registerCommand('hide', async (args: ParsedArgs, bridge: Bridge) => {
  const name = args.positional[0];
  if (!name) return { data: { error: 'Usage: ac hide <name>' }, exitCode: 1 };
  const result = await bridge.send('hide', { name });
  return { data: result, exitCode: 0 };
});

registerCommand('unhide', async (args: ParsedArgs, bridge: Bridge) => {
  const name = args.positional[0];
  if (!name) return { data: { error: 'Usage: ac unhide <name>' }, exitCode: 1 };
  const result = await bridge.send('unhide', { name });
  return { data: result, exitCode: 0 };
});

registerCommand('switch', async (args: ParsedArgs, bridge: Bridge) => {
  const name = args.positional[0];
  if (!name) return { data: { error: 'Usage: ac switch <name>' }, exitCode: 1 };
  const result = await bridge.send('switch', { name });
  return { data: result, exitCode: 0 };
});
