# agent-computer — Agent Computer

Native macOS desktop automation CLI for AI agents. Control any app through the accessibility tree.

Built for the **snapshot → act** loop: take a snapshot of any app's UI, get typed refs (`@b1`, `@t2`), then click, type, and navigate — all from the command line or TypeScript SDK.

## Why agent-computer?

- **Works with any macOS app** — native apps (TextEdit, Safari, Finder) have rich accessibility trees; Electron apps work too with automatic detection and guidance
- **Typed refs** — snapshot returns prefixed refs: `@b3` (button), `@t5` (text field), `@c1` (checkbox) — easy for LLMs to reason about
- **Short commands** — agents generate these token-by-token; fewer tokens = cheaper + faster
- **Fast** — persistent daemon with ~5ms per command over Unix domain socket
- **Auto-focus** — keyboard commands auto-switch to the grabbed app and restore your previous window

## Installation

```bash
npm install -g @skillful-agents/agent-computer
```

Or as a project dependency:

```bash
npm install @skillful-agents/agent-computer
```

### Requirements

- macOS 13+ (Ventura or later)
- Node.js 20+
- **Accessibility permission** must be granted to your terminal app

### Permissions

```bash
agent-computer permissions          # check permission status
agent-computer permissions grant    # opens System Settings
```

Grant **Accessibility** access to your terminal (Terminal.app, iTerm2, Ghostty, etc.) in System Settings → Privacy & Security → Accessibility. Screen Recording permission is needed for screenshots.

## Quick Start

```bash
# 1. See what's running
agent-computer apps

# 2. Pick a window
agent-computer windows
agent-computer grab @w1

# 3. Snapshot the UI (interactive elements only)
agent-computer snapshot -i

# 4. Interact using refs from the snapshot
agent-computer click @b3
agent-computer fill @t1 "Hello, world!"
agent-computer key cmd+s

# 5. Take a screenshot to see the result
agent-computer screenshot

# 6. Release the window
agent-computer ungrab
```

## Core Workflow

The fundamental loop for AI agents:

```
agent-computer snapshot -i  →  read refs  →  agent-computer click @b1  →  agent-computer snapshot -i  →  ...
```

1. **Observe** — `agent-computer snapshot -i` returns the accessibility tree with typed refs
2. **Act** — `agent-computer click @b1`, `agent-computer fill @t2 "text"`, `agent-computer key cmd+s`
3. **Verify** — `agent-computer snapshot -i` again, or `agent-computer screenshot` for visual confirmation

## Command Reference

### Snapshot & Observation

| Command | Description |
|---------|-------------|
| `agent-computer snapshot` | Full accessibility tree of the active window |
| `agent-computer snapshot -i` | Interactive elements only (buttons, fields, etc.) |
| `agent-computer snapshot -c` | Compact flat list |
| `agent-computer snapshot -d 3` | Limit tree depth |
| `agent-computer snapshot --app Safari` | Target a specific app |
| `agent-computer screenshot` | Take a screenshot (PNG) |
| `agent-computer screenshot /tmp/shot.png` | Save to specific path |
| `agent-computer find "Save"` | Find elements by text |
| `agent-computer find --role button` | Find elements by role |
| `agent-computer read @t1` | Read an element's value |

### Click & Mouse

| Command | Description |
|---------|-------------|
| `agent-computer click @b1` | Click an element by ref |
| `agent-computer click 500,300` | Click at screen coordinates |
| `agent-computer click @b1 --right` | Right-click |
| `agent-computer click @b1 --double` | Double-click |
| `agent-computer hover @b1` | Move mouse to element |
| `agent-computer drag @b1 @b2` | Drag from one element to another |
| `agent-computer drag --from-x 100 --from-y 200 --to-x 300 --to-y 400` | Drag by coordinates |

### Keyboard & Text

| Command | Description |
|---------|-------------|
| `agent-computer type "Hello"` | Type text into the focused element |
| `agent-computer fill @t1 "text"` | Focus, clear, and set text on an element |
| `agent-computer key cmd+a` | Press a key combination |
| `agent-computer key cmd+c` | Copy |
| `agent-computer key enter` | Press Enter |
| `agent-computer paste "text"` | Paste text via clipboard |

> **Auto-focus:** When a window is grabbed, `key`, `type`, `keydown`, `keyup`, and `paste` automatically switch to the grabbed app, perform the action, then switch back to your previous window.

### Apps & Windows

| Command | Description |
|---------|-------------|
| `agent-computer apps` | List running applications |
| `agent-computer launch TextEdit --wait` | Launch an app and wait for it to be ready |
| `agent-computer quit TextEdit` | Quit an app |
| `agent-computer switch Safari` | Bring an app to the foreground |
| `agent-computer windows` | List all windows with refs |
| `agent-computer grab @w1` | Lock onto a window for subsequent commands |
| `agent-computer grab --app TextEdit` | Grab the first window of an app |
| `agent-computer ungrab` | Release the grabbed window |

### Window Management

| Command | Description |
|---------|-------------|
| `agent-computer minimize` | Minimize the grabbed window |
| `agent-computer maximize` | Maximize (zoom) the grabbed window |
| `agent-computer fullscreen` | Toggle fullscreen |
| `agent-computer close` | Close the grabbed window |
| `agent-computer raise` | Bring window to front |
| `agent-computer move --x 100 --y 200` | Move window |
| `agent-computer resize --width 800 --height 600` | Resize window |
| `agent-computer bounds --preset left-half` | Snap to preset (left-half, right-half, fill, center) |

### Menus

| Command | Description |
|---------|-------------|
| `agent-computer menu list` | List top-level menus |
| `agent-computer menu list Edit` | List items in a menu |
| `agent-computer menu "Edit > Select All"` | Click a menu item by path |
| `agent-computer menu "Format > Font > Bold"` | Navigate nested menus |

### Scroll & Focus

| Command | Description |
|---------|-------------|
| `agent-computer scroll down` | Scroll down (3 ticks) |
| `agent-computer scroll up 10` | Scroll up 10 ticks |
| `agent-computer scroll down --on @sa1` | Scroll within a specific element |
| `agent-computer scroll down --smooth` | Smooth animated scroll |
| `agent-computer focus @t1` | Focus an element |
| `agent-computer check @c1` | Check a checkbox |
| `agent-computer uncheck @c1` | Uncheck a checkbox |
| `agent-computer select @d1 --value "Option"` | Select a dropdown value |

### Clipboard

| Command | Description |
|---------|-------------|
| `agent-computer clipboard` | Read clipboard contents |
| `agent-computer clipboard set "text"` | Set clipboard contents |

### Dialogs & Alerts

| Command | Description |
|---------|-------------|
| `agent-computer dialog` | Detect if a dialog/alert is visible |
| `agent-computer dialog accept` | Click OK/Save on the dialog |
| `agent-computer dialog cancel` | Dismiss the dialog |
| `agent-computer dialog file /tmp/doc.txt` | Set filename in a file save dialog |

### Wait

| Command | Description |
|---------|-------------|
| `agent-computer wait 2000` | Wait for 2 seconds |
| `agent-computer wait --app TextEdit` | Wait for an app to launch |
| `agent-computer wait --text "Loading complete"` | Wait for text to appear |
| `agent-computer wait --text "Loading" --gone` | Wait for text to disappear |

### Batch & Diff

| Command | Description |
|---------|-------------|
| `agent-computer batch '[["click","@b1"],["key","enter"]]'` | Execute commands sequentially |
| `agent-computer changed` | Check if UI changed since last snapshot |
| `agent-computer diff` | Get added/removed elements since last snapshot |

### System

| Command | Description |
|---------|-------------|
| `agent-computer status` | Show session state (grabbed window, daemon info) |
| `agent-computer daemon start\|stop\|restart\|status` | Manage the background daemon |
| `agent-computer permissions` | Check accessibility/screen recording permissions |
| `agent-computer doctor` | Run diagnostics |
| `agent-computer displays` | List connected displays |
| `agent-computer version` | Print version |

## Ref System

Snapshots assign typed refs based on element role:

| Prefix | Role | Example |
|--------|------|---------|
| `@b` | Button | `@b1`, `@b2` |
| `@t` | Text field | `@t1` |
| `@l` | Link | `@l1` |
| `@c` | Checkbox | `@c1` |
| `@r` | Radio button | `@r1` |
| `@s` | Slider | `@s1` |
| `@d` | Dropdown | `@d1` |
| `@i` | Image | `@i1` |
| `@g` | Group | `@g1` |
| `@w` | Window | `@w1` |
| `@m` | Menu item | `@m1` |
| `@sa` | Scroll area | `@sa1` |
| `@cb` | Combo box | `@cb1` |
| `@x` | Generic | `@x1` |

Refs are stable within a snapshot but re-assigned on each new snapshot.

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | JSON output (default is human-readable text) |
| `--timeout <ms>` | Override default timeout (default: 10000) |
| `--verbose` | Debug logging to stderr |
| `--content-boundary` | Wrap output in delimiters for LLM safety |
| `--max-output <n>` | Truncate output to N characters |
| `--app <name>` | Target a specific app (for snapshot, find, menu, etc.) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AC_JSON` | Set to `1` for JSON output |
| `AC_VERBOSE` | Set to `1` for debug logging |

## TypeScript SDK

Use `agent-computer` programmatically from Node.js:

```typescript
import { AC } from '@skillful-agents/agent-computer';

const ac = new AC();

// Launch and interact with TextEdit
await ac.launch('TextEdit', { wait: true });
await ac.grab('TextEdit');

const snap = await ac.snapshot({ interactive: true });
const textarea = snap.elements.find(e => e.role === 'textarea');

if (textarea) {
  await ac.fill(textarea.ref, 'Hello from the SDK!');
  await ac.key('cmd+a');
  await ac.menuClick('Format > Font > Bold', 'TextEdit');
}

await ac.screenshot({ path: '/tmp/result.png' });
await ac.quit('TextEdit');
await ac.disconnect();
```

### SDK Methods

The `AC` class provides typed methods for every CLI command:

```typescript
// Observation
await ac.snapshot({ interactive: true, app: 'Safari' });
await ac.find('Submit', { role: 'button' });
await ac.read('@t1');
await ac.is('enabled', '@b1');

// Actions
await ac.click('@b1');
await ac.clickAt(500, 300);
await ac.fill('@t1', 'text');
await ac.key('cmd+s');
await ac.scroll('down', { amount: 5 });
await ac.drag('@b1', '@b2');

// Menus
await ac.menuClick('File > Save');
await ac.menuList('Edit');

// Apps & Windows
await ac.launch('Calculator', { wait: true });
await ac.grab('Calculator');
await ac.windows();
await ac.ungrab();

// Dialogs
const dialog = await ac.dialog();
if (dialog.found) await ac.dialogAccept();

// Wait
await ac.waitForText('Loading complete', { timeout: 10000 });
await ac.waitForApp('Safari');

// Batch
await ac.batch([['click', '@b1'], ['key', 'enter']]);

// Diff
const { changed } = await ac.changed();
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  CLI (bin/ac.ts)  or  SDK (AC class)           │
├─────────────────────────────────────────────┤
│  Bridge — JSON-RPC 2.0 over Unix socket     │
├─────────────────────────────────────────────┤
│  Daemon (ac-core) — persistent Swift binary │
│  ┌─────────┬──────────┬──────────┐          │
│  │ AX Tree │ CGEvent  │ Screen   │          │
│  │ Walking │ Input    │ Capture  │          │
│  └─────────┴──────────┴──────────┘          │
├─────────────────────────────────────────────┤
│  macOS Accessibility + CoreGraphics APIs     │
└─────────────────────────────────────────────┘
```

- **CLI/SDK** — TypeScript, parses commands, manages daemon lifecycle
- **Bridge** — JSON-RPC 2.0 over Unix domain socket, auto-starts daemon
- **Daemon** — Native Swift binary, stays running (~5ms per command vs ~80ms one-shot)
- **Native APIs** — AXUIElement for accessibility tree, CGEvent for input, screencapture for screenshots

## Chromium/Electron Apps

Electron apps (Spotify, Slack, VS Code, Discord) have limited accessibility trees. `agent-computer` automatically detects Chromium-based apps and shows a warning:

```
⚠️  This is a Chromium/Electron app. The accessibility tree may be limited.
    Consider using keyboard shortcuts, coordinate-based clicks (agent-computer click x,y),
    or screenshots for navigation.
```

For Electron apps, prefer:
- **Keyboard shortcuts** — `agent-computer key cmd+f`, `agent-computer key space`
- **Coordinate clicks** — `agent-computer screenshot` to find positions, then `agent-computer click 500,300`
- **Paste** — `agent-computer paste "text"` instead of `agent-computer fill`

## Human-Like Mode

For automation that needs to appear more natural:

```bash
# Curved mouse movement (Bezier path)
agent-computer human_move --x 500 --y 300

# Variable-cadence typing
agent-computer human_type --text "Hello there" --delay 50

# Click with slight positional jitter
agent-computer human_click --ref @b1
```

## Examples

### Fill a form in Safari

```bash
agent-computer launch Safari --wait
agent-computer grab --app Safari
agent-computer snapshot -i
agent-computer fill @t1 "https://example.com"
agent-computer key enter
agent-computer wait --text "Example Domain"
agent-computer snapshot -i
agent-computer screenshot /tmp/page.png
agent-computer ungrab
```

### Calculator arithmetic

```bash
agent-computer launch Calculator --wait
agent-computer grab --app Calculator
agent-computer snapshot -i
agent-computer click @b7      # 7
agent-computer click @b12     # +
agent-computer click @b3      # 3
agent-computer click @b15     # =
agent-computer snapshot -i    # read the display
agent-computer quit Calculator
```

### Cross-app copy/paste

```bash
agent-computer launch TextEdit --wait
agent-computer grab --app TextEdit
agent-computer snapshot -i
agent-computer fill @t1 "Transfer this text"
agent-computer key cmd+a
agent-computer key cmd+c
agent-computer launch Notes --wait
agent-computer grab --app Notes
agent-computer key cmd+v
agent-computer snapshot -i
```

### Batch operations

```bash
agent-computer batch '[["clipboard_set", {"text": "Hello"}], ["clipboard_read"]]'
```

## Troubleshooting

### "Accessibility permission not granted"

Open System Settings → Privacy & Security → Accessibility and add your terminal app.

### Daemon not starting

```bash
agent-computer daemon status    # check if running
agent-computer daemon restart   # restart
agent-computer doctor           # full diagnostics
```

### Stale refs

Refs are re-assigned on each snapshot. If you get "Element not found", take a new snapshot:

```bash
agent-computer snapshot -i      # get fresh refs
agent-computer click @b1        # now use the new refs
```

## License

MIT

## Credits

Inspired by [agent-browser](https://github.com/anthropics/agent-browser) and [Peekaboo](https://github.com/steipete/Peekaboo).
