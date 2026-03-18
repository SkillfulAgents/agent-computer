// CLI argument parser — verb-first pattern

export interface ParsedArgs {
  command: string;
  subcommand: string | null;
  positional: string[];
  flags: Record<string, string | boolean | string[]>;
}

// Commands that have subcommands
const SUBCOMMAND_COMMANDS = new Set([
  'daemon', 'menu', 'menubar', 'clipboard', 'mouse',
  'record', 'config', 'permissions', 'dock', 'diff',
  'dialog', 'alert', 'is',
]);

// Commands where the first positional arg looks like a subcommand
const DIRECTION_COMMANDS = new Set(['scroll']);

// Flag aliases
const FLAG_ALIASES: Record<string, string> = {
  '-i': '--interactive',
  '-c': '--compact',
  '-d': '--depth',
  '-o': '--output',
  '-t': '--threshold',
};

// Flags that take a value (next arg)
const VALUE_FLAGS = new Set([
  '--timeout', '--depth', '--app', '--pid', '--window', '--subtree',
  '--on', '--modifiers', '--count', '--delay', '--repeat',
  '--format', '--quality', '--output', '--threshold',
  '--preset', '--text-match', '--role', '--attr',
  '--max-output', '--duration', '--steps', '--to-coords',
  '--from-coords', '--to-app', '--pixels', '--open',
]);

export function parseArgs(argv: string[]): ParsedArgs {
  // Strip node and script path if present
  const args = argv[0]?.includes('node') || argv[0]?.includes('tsx')
    ? argv.slice(2)
    : argv;

  const result: ParsedArgs = {
    command: '',
    subcommand: null,
    positional: [],
    flags: {},
  };

  if (args.length === 0) {
    result.command = 'help';
    return result;
  }

  let i = 0;

  // Check for global flags before command
  while (i < args.length && args[i].startsWith('-')) {
    const flag = args[i];
    if (flag === '--version') {
      result.command = 'version';
      return result;
    }
    if (flag === '--help' || flag === '-h') {
      result.command = 'help';
      return result;
    }
    // Global flags
    const resolved = FLAG_ALIASES[flag] || flag;
    const flagName = resolved.replace(/^--/, '');
    if (VALUE_FLAGS.has(resolved) && i + 1 < args.length) {
      result.flags[flagName] = args[i + 1];
      i += 2;
    } else {
      result.flags[flagName] = true;
      i += 1;
    }
  }

  // Command
  if (i >= args.length) {
    result.command = 'help';
    return result;
  }
  result.command = args[i];
  i++;

  // Subcommand (for commands that have them)
  if (SUBCOMMAND_COMMANDS.has(result.command) && i < args.length && !args[i].startsWith('-') && !args[i].startsWith('@')) {
    result.subcommand = args[i];
    i++;
  }

  // Direction for scroll
  if (DIRECTION_COMMANDS.has(result.command) && i < args.length && !args[i].startsWith('-') && !args[i].startsWith('@')) {
    result.subcommand = args[i];
    i++;
  }

  // Remaining args
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('-')) {
      const resolved = FLAG_ALIASES[arg] || arg;
      const flagName = resolved.replace(/^--/, '');

      if (VALUE_FLAGS.has(resolved) && i + 1 < args.length) {
        result.flags[flagName] = args[i + 1];
        i += 2;
      } else if (resolved === '--interactive' || resolved === '-i') {
        result.flags['interactive'] = true;
        i++;
      } else if (resolved === '--compact' || resolved === '-c') {
        result.flags['compact'] = true;
        i++;
      } else {
        // Boolean flag
        result.flags[flagName] = true;
        i++;
      }
    } else {
      result.positional.push(arg);
      i++;
    }
  }

  return result;
}

// Parse a selector: could be a ref (@b1), coordinates (100,200), or a label string
export function parseSelector(sel: string): { type: 'ref'; ref: string } | { type: 'coords'; x: number; y: number } | { type: 'label'; label: string } {
  if (sel.startsWith('@')) {
    return { type: 'ref', ref: sel };
  }

  const coordMatch = /^(\d+),(\d+)$/.exec(sel);
  if (coordMatch) {
    return { type: 'coords', x: parseInt(coordMatch[1], 10), y: parseInt(coordMatch[2], 10) };
  }

  return { type: 'label', label: sel };
}
