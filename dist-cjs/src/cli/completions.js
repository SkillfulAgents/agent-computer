"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBashCompletion = generateBashCompletion;
exports.generateZshCompletion = generateZshCompletion;
exports.installCompletions = installCompletions;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
// Shell completion generation for agent-computer CLI
// All commands registered in the CLI
const COMMANDS = [
    'snapshot', 'screenshot', 'click', 'hover', 'type', 'fill', 'key',
    'keydown', 'keyup', 'paste', 'find', 'read', 'title', 'is', 'box',
    'children', 'wait', 'apps', 'launch', 'quit', 'relaunch', 'hide',
    'unhide', 'switch', 'windows', 'grab', 'ungrab', 'status', 'clipboard',
    'dialog', 'alert', 'menu', 'menubar', 'scroll', 'focus', 'select',
    'check', 'uncheck', 'set', 'daemon', 'config', 'permissions', 'doctor',
    'ping', 'version', 'help', 'completion', 'move', 'resize', 'bounds',
    'minimize', 'maximize', 'fullscreen', 'close', 'raise', 'displays',
    'batch', 'changed', 'diff', 'drag',
];
// Subcommands per command
const SUBCOMMANDS = {
    daemon: ['start', 'stop', 'status', 'restart'],
    config: ['set', 'reset'],
    clipboard: ['set', 'copy', 'paste'],
    dialog: ['accept', 'cancel', 'file'],
    alert: ['accept', 'cancel'],
    is: ['visible', 'enabled', 'focused', 'checked'],
    scroll: ['up', 'down', 'left', 'right'],
    menu: ['list'],
    permissions: ['grant'],
    diff: ['snapshot'],
    completion: ['install', 'bash', 'zsh'],
};
// Global flags
const GLOBAL_FLAGS = [
    '--json', '--timeout', '--verbose', '--content-boundary',
    '--max-output', '--help', '--version',
];
// Per-command flags
const COMMAND_FLAGS = {
    snapshot: ['--app', '--pid', '--window', '--subtree', '--depth', '--compact', '--interactive'],
    screenshot: ['--screen', '--retina', '--format', '--quality', '--output'],
    click: ['--right', '--double', '--count', '--modifiers'],
    hover: [],
    type: ['--delay'],
    fill: [],
    key: ['--repeat', '--delay'],
    scroll: ['--pixels', '--smooth', '--steps', '--duration'],
    find: ['--app', '--pid', '--window', '--text-match', '--role', '--attr'],
    read: [],
    wait: ['--timeout'],
    apps: [],
    launch: [],
    windows: ['--app', '--pid'],
    grab: [],
    ungrab: [],
    move: ['--app'],
    resize: ['--app'],
    bounds: ['--app'],
    drag: ['--from-coords', '--to-coords', '--duration', '--steps'],
    batch: [],
    menu: ['--app'],
    menubar: [],
    dialog: [],
    alert: [],
    clipboard: [],
    select: [],
    focus: [],
    displays: [],
};
function generateBashCompletion() {
    return `# agent-computer bash completion
# Add to ~/.bashrc: eval "$(agent-computer completion bash)"

_agent_computer_completions() {
  local cur prev cmd subcmd
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Find the command (first non-flag word after the binary)
  cmd=""
  subcmd=""
  for ((i=1; i<COMP_CWORD; i++)); do
    if [[ "\${COMP_WORDS[i]}" != -* ]]; then
      if [[ -z "$cmd" ]]; then
        cmd="\${COMP_WORDS[i]}"
      elif [[ -z "$subcmd" ]]; then
        subcmd="\${COMP_WORDS[i]}"
      fi
      break
    fi
  done

  local commands="${COMMANDS.join(' ')}"
  local global_flags="${GLOBAL_FLAGS.join(' ')}"

  # No command yet — complete commands and global flags
  if [[ -z "$cmd" ]]; then
    if [[ "$cur" == -* ]]; then
      COMPREPLY=( $(compgen -W "$global_flags" -- "$cur") )
    else
      COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    fi
    return 0
  fi

  # Command entered — complete subcommands or flags
  if [[ -z "$subcmd" && "$cur" != -* ]]; then
    case "$cmd" in
${Object.entries(SUBCOMMANDS).map(([cmd, subs]) => `      ${cmd}) COMPREPLY=( $(compgen -W "${subs.join(' ')}" -- "$cur") ); return 0;;`).join('\n')}
    esac
  fi

  # Flag completion
  if [[ "$cur" == -* ]]; then
    local cmd_flags=""
    case "$cmd" in
${Object.entries(COMMAND_FLAGS).filter(([, flags]) => flags.length > 0).map(([cmd, flags]) => `      ${cmd}) cmd_flags="${flags.join(' ')}";;`).join('\n')}
    esac
    COMPREPLY=( $(compgen -W "$cmd_flags $global_flags" -- "$cur") )
    return 0
  fi
}

complete -o default -F _agent_computer_completions agent-computer
`;
}
function generateZshCompletion() {
    return `#compdef agent-computer
# agent-computer zsh completion
# Add to ~/.zshrc: eval "$(agent-computer completion zsh)"

_agent-computer() {
  local -a commands global_flags

  commands=(
${COMMANDS.map(c => `    '${c}:${commandDescription(c)}'`).join('\n')}
  )

  global_flags=(
    '--json[JSON output]'
    '--timeout[Override timeout in ms]:timeout:'
    '--verbose[Debug logging to stderr]'
    '--content-boundary[Wrap output in delimiters]'
    '--max-output[Truncate output to N characters]:max:'
    '--help[Show help]'
    '--version[Print version]'
  )

  # Are we completing a command or its arguments?
  if (( CURRENT == 2 )); then
    _describe -t commands 'agent-computer command' commands
    _values 'global flags' $global_flags
    return
  fi

  local cmd="\${words[2]}"

  case "$cmd" in
${Object.entries(SUBCOMMANDS).map(([cmd, subs]) => `    ${cmd})\n      if (( CURRENT == 3 )); then\n        local -a subcmds=(${subs.map(s => `'${s}'`).join(' ')})\n        _describe -t subcommands '${cmd} subcommand' subcmds\n        return\n      fi\n      ;;`).join('\n')}
  esac

  # Fall back to flag completion
  case "$cmd" in
${Object.entries(COMMAND_FLAGS).filter(([, flags]) => flags.length > 0).map(([cmd, flags]) => `    ${cmd}) _arguments ${flags.map(f => `'${f}[${flagDescription(f)}]'`).join(' ')} $global_flags ;;`).join('\n')}
    *) _arguments $global_flags ;;
  esac
}

_agent-computer "$@"
`;
}
function commandDescription(cmd) {
    const descs = {
        snapshot: 'Snapshot accessibility tree',
        screenshot: 'Take a screenshot',
        click: 'Click an element',
        hover: 'Hover an element',
        type: 'Type text',
        fill: 'Focus, clear, and type',
        key: 'Press key combination',
        keydown: 'Press key down',
        keyup: 'Release key',
        paste: 'Paste text',
        find: 'Find elements by text',
        read: 'Read element value',
        title: 'Get window title',
        is: 'Check element state',
        box: 'Get element bounds',
        children: 'Get child elements',
        wait: 'Wait for condition',
        apps: 'List applications',
        launch: 'Launch application',
        quit: 'Quit application',
        relaunch: 'Relaunch application',
        hide: 'Hide application',
        unhide: 'Unhide application',
        switch: 'Switch to application',
        windows: 'List windows',
        grab: 'Set active window',
        ungrab: 'Clear active window',
        status: 'Show session state',
        clipboard: 'Clipboard operations',
        dialog: 'Handle dialogs',
        alert: 'Handle alerts',
        menu: 'Click menu item',
        menubar: 'Menubar extras',
        scroll: 'Scroll in direction',
        focus: 'Focus element',
        select: 'Select from dropdown',
        check: 'Check checkbox',
        uncheck: 'Uncheck checkbox',
        set: 'Set element value',
        daemon: 'Manage daemon',
        config: 'Configuration',
        permissions: 'Permission status',
        doctor: 'Run diagnostics',
        ping: 'Ping daemon',
        version: 'Print version',
        help: 'Show help',
        completion: 'Shell completions',
        move: 'Move window',
        resize: 'Resize window',
        bounds: 'Set window bounds',
        minimize: 'Minimize window',
        maximize: 'Maximize window',
        fullscreen: 'Toggle fullscreen',
        close: 'Close window',
        raise: 'Raise window',
        displays: 'List displays',
        batch: 'Execute batch commands',
        changed: 'Detect changes',
        diff: 'Diff snapshots',
        drag: 'Drag operation',
    };
    return descs[cmd] || cmd;
}
const COMPLETION_TAG = '# agent-computer shell completions';
function installCompletions() {
    if ((0, os_1.platform)() === 'win32') {
        return 'Shell completions are not supported on Windows (PowerShell completion coming soon)';
    }
    const home = (0, os_1.homedir)();
    const completionsDir = (0, path_1.join)(home, '.agent-computer', 'completions');
    (0, fs_1.mkdirSync)(completionsDir, { recursive: true });
    // Write zsh completion
    const zshFile = (0, path_1.join)(completionsDir, '_agent-computer');
    (0, fs_1.writeFileSync)(zshFile, generateZshCompletion());
    // Write bash completion
    const bashFile = (0, path_1.join)(completionsDir, 'agent-computer.bash');
    (0, fs_1.writeFileSync)(bashFile, generateBashCompletion());
    const messages = [];
    // Wire up zsh: add fpath to .zshrc if not already there
    const zshrc = (0, path_1.join)(home, '.zshrc');
    const hasCompinit = fileContains(zshrc, 'compinit');
    const compInitLine = hasCompinit ? '' : '\nautoload -Uz compinit && compinit';
    const zshSnippet = `\n${COMPLETION_TAG}\nfpath=(~/.agent-computer/completions $fpath)${compInitLine}\n`;
    if (!rcContainsTag(zshrc)) {
        (0, fs_1.appendFileSync)(zshrc, zshSnippet);
        messages.push(`Updated ~/.zshrc`);
    }
    else {
        messages.push(`~/.zshrc already configured`);
    }
    // Wire up bash: source the completion file from .bashrc or .bash_profile
    const bashrc = (0, path_1.join)(home, bashRcName());
    const bashSnippet = `\n${COMPLETION_TAG}\nsource ~/.agent-computer/completions/agent-computer.bash\n`;
    if (!rcContainsTag(bashrc)) {
        (0, fs_1.appendFileSync)(bashrc, bashSnippet);
        messages.push(`Updated ~/${bashRcName()}`);
    }
    else {
        messages.push(`~/${bashRcName()} already configured`);
    }
    messages.push('Restart your shell or run: exec $SHELL');
    return messages.join('\n');
}
function rcContainsTag(rcPath) {
    return fileContains(rcPath, COMPLETION_TAG);
}
function fileContains(filePath, text) {
    if (!(0, fs_1.existsSync)(filePath))
        return false;
    try {
        return (0, fs_1.readFileSync)(filePath, 'utf8').includes(text);
    }
    catch {
        return false;
    }
}
function bashRcName() {
    const home = (0, os_1.homedir)();
    if ((0, fs_1.existsSync)((0, path_1.join)(home, '.bashrc')))
        return '.bashrc';
    return '.bash_profile';
}
function flagDescription(flag) {
    const descs = {
        '--app': 'Filter by app',
        '--pid': 'Filter by PID',
        '--window': 'Filter by window',
        '--subtree': 'Subtree root ref',
        '--depth': 'Tree depth',
        '--compact': 'Compact output',
        '--interactive': 'Interactive mode',
        '--screen': 'Full screen capture',
        '--retina': 'Retina resolution',
        '--format': 'Image format',
        '--quality': 'Image quality',
        '--output': 'Output path',
        '--right': 'Right click',
        '--double': 'Double click',
        '--count': 'Click count',
        '--modifiers': 'Key modifiers',
        '--delay': 'Delay between keys',
        '--repeat': 'Repeat count',
        '--pixels': 'Scroll pixels',
        '--smooth': 'Smooth scroll',
        '--steps': 'Animation steps',
        '--duration': 'Animation duration',
        '--text-match': 'Text match mode',
        '--role': 'Filter by role',
        '--attr': 'Filter by attribute',
        '--timeout': 'Timeout in ms',
        '--from-coords': 'Drag start coords',
        '--to-coords': 'Drag end coords',
    };
    return descs[flag] || flag.replace('--', '');
}
