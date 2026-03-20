# ac — Agent Computer

Native macOS desktop automation CLI for AI agents. Control any app through the accessibility tree.

Built for the **snapshot → act** loop: take a snapshot of any app's UI, get typed refs (`@b1`, `@t2`), then click, type, and navigate — all from the command line or TypeScript SDK.

## Why ac?

- **Works with any macOS app** — native apps (TextEdit, Safari, Finder) have rich accessibility trees; Electron apps work too with automatic detection and guidance
- **Typed refs** — snapshot returns prefixed refs: `@b3` (button), `@t5` (text field), `@c1` (checkbox) — easy for LLMs to reason about
- **Short commands** — agents generate these token-by-token; fewer tokens = cheaper + faster
- **Fast** — persistent daemon with ~5ms per command over Unix domain socket
- **Auto-focus** — keyboard commands auto-switch to the grabbed app and restore your previous window

## Installation

```bash
npm install -g @datawizz/ac
```

Or as a project dependency:

```bash
npm install @datawizz/ac
```

### Requirements

- macOS 13+ (Ventura or later)
- Node.js 20+
- **Accessibility permission** must be granted to your terminal app

### Permissions

```bash
ac permissions          # check permission status
ac permissions grant    # opens System Settings
```

Grant **Accessibility** access to your terminal (Terminal.app, iTerm2, Ghostty, etc.) in System Settings → Privacy & Security → Accessibility. Screen Recording permission is needed for screenshots.

## Quick Start

```bash
# 1. See what's running
ac apps

# 2. Pick a window
ac windows
ac grab @w1

# 3. Snapshot the UI (interactive elements only)
ac snapshot -i

# 4. Interact using refs from the snapshot
ac click @b3
ac fill @t1 "Hello, world!"
ac key cmd+s

# 5. Take a screenshot to see the result
ac screenshot

# 6. Release the window
ac ungrab
```

## Core Workflow

The fundamental loop for AI agents:

```
ac snapshot -i  →  read refs  →  ac click @b1  →  ac snapshot -i  →  ...
```

1. **Observe** — `ac snapshot -i` returns the accessibility tree with typed refs
2. **Act** — `ac click @b1`, `ac fill @t2 "text"`, `ac key cmd+s`
3. **Verify** — `ac snapshot -i` again, or `ac screenshot` for visual confirmation

## Command Reference

### Snapshot & Observation

| Command | Description |
|---------|-------------|
| `ac snapshot` | Full accessibility tree of the active window |
| `ac snapshot -i` | Interactive elements only (buttons, fields, etc.) |
| `ac snapshot -c` | Compact flat list |
| `ac snapshot -d 3` | Limit tree depth |
| `ac snapshot --app Safari` | Target a specific app |
| `ac screenshot` | Take a screenshot (PNG) |
| `ac screenshot /tmp/shot.png` | Save to specific path |
| `ac find "Save"` | Find elements by text |
| `ac find --role button` | Find elements by role |
| `ac read @t1` | Read an element's value |

### Click & Mouse

| Command | Description |
|---------|-------------|
| `ac click @b1` | Click an element by ref |
| `ac click 500,300` | Click at screen coordinates |
| `ac click @b1 --right` | Right-click |
| `ac click @b1 --double` | Double-click |
| `ac hover @b1` | Move mouse to element |
| `ac drag @b1 @b2` | Drag from one element to another |
| `ac drag --from-x 100 --from-y 200 --to-x 300 --to-y 400` | Drag by coordinates |

### Keyboard & Text

| Command | Description |
|---------|-------------|
| `ac type "Hello"` | Type text into the focused element |
| `ac fill @t1 "text"` | Focus, clear, and set text on an element |
| `ac key cmd+a` | Press a key combination |
| `ac key cmd+c` | Copy |
| `ac key enter` | Press Enter |
| `ac paste "text"` | Paste text via clipboard |

> **Auto-focus:** When a window is grabbed, `key`, `type`, `keydown`, `keyup`, and `paste` automatically switch to the grabbed app, perform the action, then switch back to your previous window.

### Apps & Windows

| Command | Description |
|---------|-------------|
| `ac apps` | List running applications |
| `ac launch TextEdit --wait` | Launch an app and wait for it to be ready |
| `ac quit TextEdit` | Quit an app |
| `ac switch Safari` | Bring an app to the foreground |
| `ac windows` | List all windows with refs |
| `ac grab @w1` | Lock onto a window for subsequent commands |
| `ac grab --app TextEdit` | Grab the first window of an app |
| `ac ungrab` | Release the grabbed window |

### Window Management

| Command | Description |
|---------|-------------|
| `ac minimize` | Minimize the grabbed window |
| `ac maximize` | Maximize (zoom) the grabbed window |
| `ac fullscreen` | Toggle fullscreen |
| `ac close` | Close the grabbed window |
| `ac raise` | Bring window to front |
| `ac move --x 100 --y 200` | Move window |
| `ac resize --width 800 --height 600` | Resize window |
| `ac bounds --preset left-half` | Snap to preset (left-half, right-half, fill, center) |

### Menus

| Command | Description |
|---------|-------------|
| `ac menu list` | List top-level menus |
| `ac menu list Edit` | List items in a menu |
| `ac menu "Edit > Select All"` | Click a menu item by path |
| `ac menu "Format > Font > Bold"` | Navigate nested menus |

### Scroll & Focus

| Command | Description |
|---------|-------------|
| `ac scroll down` | Scroll down (3 ticks) |
| `ac scroll up 10` | Scroll up 10 ticks |
| `ac scroll down --on @sa1` | Scroll within a specific element |
| `ac scroll down --smooth` | Smooth animated scroll |
| `ac focus @t1` | Focus an element |
| `ac check @c1` | Check a checkbox |
| `ac uncheck @c1` | Uncheck a checkbox |
| `ac select @d1 --value "Option"` | Select a dropdown value |

### Clipboard

| Command | Description |
|---------|-------------|
| `ac clipboard` | Read clipboard contents |
| `ac clipboard set "text"` | Set clipboard contents |

### Dialogs & Alerts

| Command | Description |
|---------|-------------|
| `ac dialog` | Detect if a dialog/alert is visible |
| `ac dialog accept` | Click OK/Save on the dialog |
| `ac dialog cancel` | Dismiss the dialog |
| `ac dialog file /tmp/doc.txt` | Set filename in a file save dialog |

### Wait

| Command | Description |
|---------|-------------|
| `ac wait 2000` | Wait for 2 seconds |
| `ac wait --app TextEdit` | Wait for an app to launch |
| `ac wait --text "Loading complete"` | Wait for text to appear |
| `ac wait --text "Loading" --gone` | Wait for text to disappear |

### Batch & Diff

| Command | Description |
|---------|-------------|
| `ac batch '[["click","@b1"],["key","enter"]]'` | Execute commands sequentially |
| `ac changed` | Check if UI changed since last snapshot |
| `ac diff` | Get added/removed elements since last snapshot |

### System

| Command | Description |
|---------|-------------|
| `ac status` | Show session state (grabbed window, daemon info) |
| `ac daemon start\|stop\|restart\|status` | Manage the background daemon |
| `ac permissions` | Check accessibility/screen recording permissions |
| `ac doctor` | Run diagnostics |
| `ac displays` | List connected displays |
| `ac version` | Print version |

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

Use `ac` programmatically from Node.js:

```typescript
import { AC } from '@datawizz/ac';

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
│  CLI (bin/ac.ts)  or  SDK (AC class)        │
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

Electron apps (Spotify, Slack, VS Code, Discord) have limited accessibility trees. `ac` automatically detects Chromium-based apps and shows a warning:

```
⚠️  This is a Chromium/Electron app. The accessibility tree may be limited.
    Consider using keyboard shortcuts, coordinate-based clicks (ac click x,y),
    or screenshots for navigation.
```

For Electron apps, prefer:
- **Keyboard shortcuts** — `ac key cmd+f`, `ac key space`
- **Coordinate clicks** — `ac screenshot` to find positions, then `ac click 500,300`
- **Paste** — `ac paste "text"` instead of `ac fill`

## Human-Like Mode

For automation that needs to appear more natural:

```bash
# Curved mouse movement (Bezier path)
ac human_move --x 500 --y 300

# Variable-cadence typing
ac human_type --text "Hello there" --delay 50

# Click with slight positional jitter
ac human_click --ref @b1
```

## Examples

### Fill a form in Safari

```bash
ac launch Safari --wait
ac grab --app Safari
ac snapshot -i
ac fill @t1 "https://example.com"
ac key enter
ac wait --text "Example Domain"
ac snapshot -i
ac screenshot /tmp/page.png
ac ungrab
```

### Calculator arithmetic

```bash
ac launch Calculator --wait
ac grab --app Calculator
ac snapshot -i
ac click @b7      # 7
ac click @b12     # +
ac click @b3      # 3
ac click @b15     # =
ac snapshot -i    # read the display
ac quit Calculator
```

### Cross-app copy/paste

```bash
ac launch TextEdit --wait
ac grab --app TextEdit
ac snapshot -i
ac fill @t1 "Transfer this text"
ac key cmd+a
ac key cmd+c
ac launch Notes --wait
ac grab --app Notes
ac key cmd+v
ac snapshot -i
```

### Batch operations

```bash
ac batch '[["clipboard_set", {"text": "Hello"}], ["clipboard_read"]]'
```

## Troubleshooting

### "Accessibility permission not granted"

Open System Settings → Privacy & Security → Accessibility and add your terminal app.

### Daemon not starting

```bash
ac daemon status    # check if running
ac daemon restart   # restart
ac doctor           # full diagnostics
```

### Stale refs

Refs are re-assigned on each snapshot. If you get "Element not found", take a new snapshot:

```bash
ac snapshot -i      # get fresh refs
ac click @b1        # now use the new refs
```

## License

MIT

## Credits

Inspired by [agent-browser](https://github.com/anthropics/agent-browser) and [Peekaboo](https://github.com/steipete/Peekaboo).
