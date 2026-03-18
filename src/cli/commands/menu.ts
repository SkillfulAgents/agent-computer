import { registerCommand } from '../commands.js';
import type { ParsedArgs } from '../parser.js';
import type { Bridge } from '../../bridge.js';

registerCommand('menu', async (args: ParsedArgs, bridge: Bridge) => {
  const sub = args.subcommand;

  if (sub === 'list') {
    // ac menu list [name] [--all] [--app name]
    const params: Record<string, unknown> = {};
    if (args.positional[0]) params.menu = args.positional[0];
    if (args.flags['all']) params.all = true;
    if (args.flags['app']) params.app = args.flags['app'];

    const result = await bridge.send('menu_list', params);
    return { data: result, exitCode: 0 };
  }

  if (sub) {
    // ac menu "File > Save" — click by path
    const params: Record<string, unknown> = { path: sub };
    if (args.flags['app']) params.app = args.flags['app'];

    const result = await bridge.send('menu_click', params);
    return { data: result, exitCode: 0 };
  }

  return { data: { error: 'Usage: ac menu <path> | ac menu list [name]' }, exitCode: 1 };
});

registerCommand('menubar', async (args: ParsedArgs, bridge: Bridge) => {
  const sub = args.subcommand;

  if (sub === 'click' && args.positional[0]) {
    // Click a menubar extra — not fully implemented yet
    return { data: { error: 'menubar click not yet implemented' }, exitCode: 1 };
  }

  const result = await bridge.send('menubar');
  return { data: result, exitCode: 0 };
});
