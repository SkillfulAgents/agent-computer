import type { ParsedArgs } from './parser.js';
import { Bridge } from '../bridge.js';
import { DaemonManager } from '../daemon.js';
import { resolveConfig, setConfigValue, resetConfig, getDefaults, type ACConfig } from '../config.js';

export type CommandResult = {
  data: unknown;
  exitCode: number;
};

type CommandHandler = (args: ParsedArgs, bridge: Bridge) => Promise<CommandResult>;

const commands: Record<string, CommandHandler> = {};
let commandModulesLoaded = false;

export function registerCommand(name: string, handler: CommandHandler): void {
  commands[name] = handler;
}

async function ensureCommandModulesLoaded(): Promise<void> {
  if (commandModulesLoaded) return;
  commandModulesLoaded = true;
  await import('./commands/apps.js');
  await import('./commands/windows.js');
  await import('./commands/session.js');
  await import('./commands/snapshot.js');
  await import('./commands/click.js');
  await import('./commands/type.js');
  await import('./commands/clipboard.js');
  await import('./commands/windowmgmt.js');
  await import('./commands/screenshot.js');
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands[name];
}

export async function getCommandAsync(name: string): Promise<CommandHandler | undefined> {
  await ensureCommandModulesLoaded();
  return commands[name];
}

export function getAllCommands(): string[] {
  return Object.keys(commands).sort();
}

// Register built-in commands

registerCommand('version', async () => {
  return { data: { version: '0.1.0' }, exitCode: 0 };
});

registerCommand('help', async () => {
  const help = `ac — Agent Computer CLI for macOS

Usage: ac <command> [options]

Commands:
  snapshot              Snapshot the accessibility tree
  screenshot [path]     Take a screenshot
  click <sel>           Click an element
  type <text>           Type text
  fill <sel> <text>     Focus, clear, and type into an element
  key <combo>           Press a key combination
  find <text>           Find elements by text
  read <sel>            Read element value
  scroll <dir> [amount] Scroll in a direction
  menu <path>           Click a menu item by path

  apps                  List applications
  launch <name>         Launch an application
  quit <name>           Quit an application
  windows               List windows
  grab <sel>            Set active window context
  ungrab                Clear active window context
  status                Show session state

  wait <sel|ms>         Wait for condition
  clipboard [set <text>] Clipboard operations
  alert                 Handle alerts
  dialog                Handle dialogs

  daemon <start|stop|status|restart>  Manage daemon
  config [set <key> <val> | reset]    Configuration
  permissions [grant]                 Permission status
  doctor                              Run diagnostics
  version                             Print version

Global options:
  --text                Human-readable output (default: JSON)
  --timeout <ms>        Override timeout (default: 10000)
  --verbose             Debug logging to stderr
  --content-boundary    Wrap output in delimiters
  --max-output <n>      Truncate output to N characters

See: https://github.com/datawizz/ac`;

  return { data: help, exitCode: 0 };
});

registerCommand('daemon', async (args) => {
  const manager = new DaemonManager();
  const sub = args.subcommand;

  switch (sub) {
    case 'start': {
      const status = await manager.start();
      return { data: status, exitCode: 0 };
    }
    case 'stop': {
      await manager.stop();
      return { data: { ok: true }, exitCode: 0 };
    }
    case 'status': {
      const status = await manager.status();
      return { data: status, exitCode: 0 };
    }
    case 'restart': {
      const status = await manager.restart();
      return { data: status, exitCode: 0 };
    }
    default:
      return { data: { error: `Unknown daemon subcommand: ${sub}. Use: start, stop, status, restart` }, exitCode: 1 };
  }
});

registerCommand('config', async (args) => {
  const sub = args.subcommand;

  switch (sub) {
    case 'set': {
      const key = args.positional[0] as keyof ACConfig | undefined;
      const value = args.positional[1];
      if (!key || value === undefined) {
        return { data: { error: 'Usage: ac config set <key> <value>' }, exitCode: 1 };
      }
      const defaults = getDefaults();
      if (!(key in defaults)) {
        return { data: { error: `Unknown config key: ${key}` }, exitCode: 1 };
      }
      // Coerce value to correct type
      const defaultVal = defaults[key];
      let coerced: unknown = value;
      if (typeof defaultVal === 'number') coerced = parseInt(value, 10);
      if (typeof defaultVal === 'boolean') coerced = value === 'true' || value === '1';
      setConfigValue(key, coerced as never);
      return { data: { ok: true, key, value: coerced }, exitCode: 0 };
    }
    case 'reset': {
      resetConfig();
      return { data: { ok: true }, exitCode: 0 };
    }
    default: {
      // Show current config
      const config = resolveConfig();
      return { data: config, exitCode: 0 };
    }
  }
});

registerCommand('ping', async (_args, bridge) => {
  const result = await bridge.send('ping');
  return { data: result, exitCode: 0 };
});

registerCommand('status', async (_args, bridge) => {
  const result = await bridge.send('status');
  return { data: result, exitCode: 0 };
});

registerCommand('permissions', async (args, bridge) => {
  if (args.subcommand === 'grant') {
    const result = await bridge.send('permissions_grant');
    return { data: result, exitCode: 0 };
  }
  const result = await bridge.send('permissions');
  return { data: result, exitCode: 0 };
});

registerCommand('doctor', async (_args, bridge) => {
  const [permissions, version, daemonStatus] = await Promise.all([
    bridge.send('permissions') as Promise<Record<string, unknown>>,
    bridge.send('version') as Promise<Record<string, unknown>>,
    new DaemonManager().status(),
  ]);
  const result = {
    version: (version as Record<string, unknown>).version,
    permissions,
    daemon: daemonStatus,
    platform: process.platform,
    arch: process.arch,
  };
  return { data: result, exitCode: 0 };
});
