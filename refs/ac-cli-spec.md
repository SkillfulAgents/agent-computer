# `agent-computer` — Agent Computer CLI for macOS

> Native macOS desktop automation CLI for AI agents.
> Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) and [Peekaboo](https://github.com/steipete/Peekaboo).

## Design Principles

- **Short commands** — agents generate these token-by-token; fewer tokens = cheaper + faster
- **Verb-first for actions** — `ac click`, not `ac element click`
- **Typed refs** — snapshot returns prefixed refs: `@b3` (button), `@t5` (text field), etc.
- **Text-first** — all output is human-readable by default; `--json` for JSON
- **Stateful context** — `grab` sets the active window; all subsequent commands target it
- **Snapshot → act** — the core loop: `ac snapshot` → read refs → `ac click @b3`

---

## Ref Format

Refs are emitted by `snapshot` and are stable until the next `snapshot` call.

| Prefix | AX Role                  | Example |
|--------|--------------------------|---------|
| `@b`   | Button                   | `@b1`   |
| `@t`   | Text field / Text area   | `@t2`   |
| `@l`   | Link                     | `@l3`   |
| `@m`   | Menu item                | `@m4`   |
| `@c`   | Checkbox                 | `@c5`   |
| `@r`   | Radio button             | `@r6`   |
| `@s`   | Slider                   | `@s7`   |
| `@d`   | Dropdown / Pop-up button | `@d8`   |
| `@i`   | Image                    | `@i9`   |
| `@g`   | Group / Container        | `@g10`  |
| `@w`   | Window                   | `@w1`   |
| `@x`   | Table / Grid             | `@x11`  |
| `@o`   | Row / Cell               | `@o12`  |
| `@a`   | Tab                      | `@a13`  |
| `@e`   | Generic element (other)  | `@e14`  |

Two-letter prefixes are used for less common roles to avoid collisions:

| Prefix | AX Role                  | Example  |
|--------|--------------------------|----------|
| `@cb`  | ComboBox                 | `@cb1`   |
| `@sa`  | Scroll area              | `@sa2`   |
| `@st`  | Stepper                  | `@st3`   |
| `@sp`  | Split group              | `@sp4`   |
| `@tl`  | Timeline                 | `@tl5`   |
| `@pg`  | Progress indicator       | `@pg6`   |
| `@tv`  | Tree view                | `@tv7`   |
| `@wb`  | Web area                 | `@wb8`   |

Any AX role not in either table falls back to `@e` (generic).

Refs can be used anywhere a `<sel>` argument appears.

---

## Global Options

| Flag                 | Description                                        |
|----------------------|----------------------------------------------------|
| `--json`             | JSON output (default is human-readable text)       |
| `--timeout <ms>`     | Override default timeout (default: 10000)           |
| `--verbose`          | Debug logging to stderr                            |
| `--content-boundary` | Wrap output in delimiters for LLM safety           |
| `--max-output <n>`   | Truncate output to N characters                    |

---

## Session & Context

| Command                      | Description                                                              |
|------------------------------|--------------------------------------------------------------------------|
| `ac grab <@w>`               | Set the active window context. Subsequent commands target this window.   |
| `ac grab --app <name>`       | Grab the frontmost window of a named app.                                |
| `ac ungrab`                  | Clear the active window context.                                         |
| `ac status`                  | Show current session state (grabbed window, last snapshot id, etc.)      |

> When a window is grabbed, all `snapshot`, `click`, `screenshot`, etc. operate on that window.
> Pass `--window <@w>` on any command to override the grabbed window for a single call.

---

## Apps

| Command                                 | Description                                                    |
|-----------------------------------------|----------------------------------------------------------------|
| `ac apps`                               | List all installed applications.                               |
| `ac apps --running`                     | List currently running applications.                           |
| `ac launch <name>`                      | Launch an application by name.                                 |
| `ac launch <name> --open <path\|url>`   | Launch and open a file or URL (repeatable).                    |
| `ac launch <name> --wait`               | Wait until the app is ready before returning.                  |
| `ac launch <name> --background`         | Launch without bringing to foreground.                         |
| `ac quit <name>`                        | Quit an application gracefully.                                |
| `ac quit <name> --force`                | Force-quit an application.                                     |
| `ac relaunch <name>`                    | Quit and relaunch an application.                              |
| `ac hide <name>`                        | Hide an application.                                           |
| `ac unhide <name>`                      | Unhide an application.                                         |
| `ac switch <name>`                      | Bring an application to the foreground (activate).             |

---

## Windows

| Command                                      | Description                                                        |
|----------------------------------------------|--------------------------------------------------------------------|
| `ac windows`                                 | List all open windows with refs, app name, title, state (minimized/hidden). |
| `ac windows --app <name>`                    | List windows for a specific app.                                   |
| `ac minimize <@w>`                           | Minimize a window.                                                 |
| `ac maximize <@w>`                           | Maximize / zoom a window.                                          |
| `ac fullscreen <@w>`                         | Toggle fullscreen on a window.                                     |
| `ac close <@w>`                              | Close a window.                                                    |
| `ac raise <@w>`                              | Bring a window to the front and focus it.                          |
| `ac move <@w> <x> <y>`                       | Move a window to screen coordinates.                               |
| `ac resize <@w> <w> <h>`                     | Resize a window.                                                   |
| `ac bounds <@w> <x> <y> <w> <h>`            | Set window position and size in one call.                          |
| `ac bounds <@w> --preset <name>`             | Presets: `left-half`, `right-half`, `top-half`, `bottom-half`, `center`, `fill` |

---

## Snapshot & Screenshot

| Command                                      | Description                                                          |
|----------------------------------------------|----------------------------------------------------------------------|
| `ac snapshot`                                | Return the accessibility tree with typed refs for the grabbed window. |
| `ac snapshot -i`                             | Interactive elements only (buttons, inputs, links, etc.)             |
| `ac snapshot -c`                             | Compact — flatten hierarchy, remove empty structural elements.       |
| `ac snapshot -d <n>`                         | Limit tree depth to N levels.                                        |
| `ac snapshot --subtree <sel>`                | Snapshot only the subtree rooted at the given element.               |
| `ac snapshot --app <name>`                   | Snapshot the frontmost window of the named app.                      |
| `ac snapshot --pid <pid>`                    | Snapshot a window by process ID (useful for disambiguating multiple instances). |
| `ac snapshot --screen`                       | Snapshot all visible windows on the screen.                          |
| `ac screenshot [path]`                       | Take a screenshot of the active window. Auto-generates path if omitted. |
| `ac screenshot --screen [path]`              | Full screen screenshot.                                              |
| `ac screenshot --retina`                     | Capture at 2× Retina resolution.                                    |
| `ac screenshot --annotate`                   | Overlay numbered ref labels on interactive elements.                 |
| `ac screenshot --format <png\|jpeg>`         | Output format (default: png).                                        |
| `ac screenshot --quality <0-100>`            | JPEG quality.                                                        |

Default output is a hierarchical tree with indentation showing element containment.
The currently focused element is marked with `*`.

Snapshot output example (default — hierarchical):
```
[@w1] Window "My App"
  [@g1] Group "Toolbar"
    [@b1] Button "Save" (enabled, 120,40 80×24)
    [@d4] PopUpButton "Language" value="English" (enabled, 400,40 150×24)
  [@g2] Group "Content"
    *[@t2] TextArea "Editor" value="Hello world..." (focused, 0,64 800×500)
    [@l3] Link "Learn more" (enabled, 200,300 120×16)
    [@c5] Checkbox "Dark mode" value=0 (enabled, 400,80 120×20)
```

Snapshot output example (compact `-c` — flat list, no hierarchy):
```
[@b1] Button "Save" (enabled, 120,40 80×24)
*[@t2] TextArea "Editor" value="Hello world..." (focused, 0,64 800×500)
[@l3] Link "Learn more" (enabled, 200,300 120×16)
[@d4] PopUpButton "Language" value="English" (enabled, 400,40 150×24)
[@c5] Checkbox "Dark mode" value=0 (enabled, 400,80 120×20)
```

---

## Interaction — Click & Mouse

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac click <sel>`                             | Click an element by ref, label, or coordinates.            |
| `ac click <sel> --right`                     | Right-click.                                               |
| `ac click <sel> --double`                    | Double-click.                                              |
| `ac click <sel> --count <n>`                 | Click N times.                                             |
| `ac click <sel> --modifiers <keys>`          | Hold modifiers while clicking (e.g. `shift`, `cmd,opt`).   |
| `ac click <sel> --wait`                      | Wait for the element to appear before clicking (respects `--timeout`). |
| `ac click <sel> --human`                     | Human-like click (slight cursor path jitter and timing variance). |
| `ac click <x>,<y>`                          | Click at absolute screen coordinates.                      |
| `ac hover <sel>`                             | Move cursor to an element without clicking.                |
| `ac hover <x>,<y>`                          | Move cursor to coordinates.                                |
| `ac hover <sel> --human`                     | Human-like cursor movement (curved path, overshoot).       |
| `ac mouse down [button]`                     | Press mouse button (left/right/middle).                    |
| `ac mouse up [button]`                       | Release mouse button.                                      |

---

## Interaction — Keyboard

| Command                                      | Description                                                  |
|----------------------------------------------|--------------------------------------------------------------|
| `ac type <text>`                             | Type text into the focused element (simulates keystrokes).   |
| `ac type <text> --delay <ms>`                | Type with delay between keystrokes.                          |
| `ac type <text> --clear`                     | Clear the field before typing.                               |
| `ac type <text> --human`                     | Human-like typing (variable cadence, occasional pauses).     |
| `ac fill <sel> <text>`                       | Focus element, clear it, and type text (combined action).    |
| `ac fill <sel> <text> --wait`                | Wait for the element to appear before filling.               |
| `ac key <combo>`                             | Press a key combo: `enter`, `tab`, `cmd+s`, `cmd+shift+t`.  |
| `ac key <combo> --repeat <n>`                | Press the combo N times.                                     |
| `ac keydown <key>`                           | Hold a key down.                                             |
| `ac keyup <key>`                             | Release a key.                                               |
| `ac paste <text>`                            | Set clipboard and paste (Cmd+V). Restores original clipboard. **Note:** a race condition exists if the user copies something between set and restore — the user's copy will be lost. |

Key names: `enter`, `return`, `tab`, `escape`, `space`, `delete`, `backspace`,
`up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`,
`f1`–`f12`, `cmd`, `ctrl`, `opt`/`alt`, `shift`

---

## Interaction — Scroll

Follows Peekaboo's directional model with element targeting and smooth mode.

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac scroll down [amount]`                    | Scroll down (default: 3 ticks).                            |
| `ac scroll up [amount]`                      | Scroll up.                                                 |
| `ac scroll left [amount]`                    | Scroll left.                                               |
| `ac scroll right [amount]`                   | Scroll right.                                              |
| `ac scroll <dir> --on <sel>`                 | Scroll within a specific scroll area element.              |
| `ac scroll <dir> --smooth`                   | Smooth scrolling (animated, human-like).                   |
| `ac scroll <dir> --pixels <n>`               | Scroll by exact pixel amount.                              |
| `ac scrollto <sel>`                          | Scroll until the element is visible.                       |

---

## Interaction — Drag & Drop

| Command                                              | Description                                               |
|------------------------------------------------------|-----------------------------------------------------------|
| `ac drag <from_sel> <to_sel>`                        | Drag one element onto another.                            |
| `ac drag <from_sel> --to-coords <x>,<y>`            | Drag element to absolute coordinates.                     |
| `ac drag --from-coords <x>,<y> --to-coords <x>,<y>` | Drag between coordinate pairs.                            |
| `ac drag <from_sel> <to_sel> --modifiers <keys>`     | Hold modifiers during drag (e.g. `shift` for range).      |
| `ac drag <from_sel> <to_sel> --duration <ms>`        | Drag duration in ms (default: 500).                       |
| `ac drag <from_sel> <to_sel> --steps <n>`            | Interpolation steps (smoother motion).                    |
| `ac drag <from_sel> --to-app <name>`                 | Drag element into another app (e.g. Dock's Trash).        |

---

## Interaction — Focus & Selection

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac focus <sel>`                             | Set keyboard focus on an element.                          |
| `ac select <sel> <value>`                    | Select an option in a dropdown/popup by value or label.    |
| `ac check <sel>`                             | Check a checkbox or toggle (idempotent).                   |
| `ac uncheck <sel>`                           | Uncheck a checkbox or toggle (idempotent).                 |
| `ac set <sel> <value>`                       | Set the value of a slider, stepper, or text field.         |

---

## Find

Search for elements without taking a full snapshot.

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac find <text>`                             | Find elements whose label contains the text.               |
| `ac find <text> --role <role>`               | Filter by AX role (e.g. `button`, `link`, `textfield`).    |
| `ac find <text> --first`                     | Return only the first match.                               |
| `ac find --role <role>`                      | Find all elements of a given role.                         |

Returns refs that can be used immediately in subsequent commands. Refs from `find` share the same ref space as the last `snapshot`.

---

## Read & Inspect

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac read <sel>`                              | Get the value/text content of an element.                  |
| `ac read <sel> --attr <name>`                | Get a specific accessibility attribute.                    |
| `ac title`                                   | Get the title of the active window.                        |
| `ac title --app`                             | Get the frontmost app's name.                              |
| `ac is visible <sel>`                        | Check if an element is visible.                            |
| `ac is enabled <sel>`                        | Check if an element is enabled.                            |
| `ac is focused <sel>`                        | Check if an element has focus.                             |
| `ac is checked <sel>`                        | Check if a checkbox/radio is checked.                      |
| `ac box <sel>`                               | Get bounding box (x, y, width, height).                    |
| `ac children <sel>`                          | List direct children of an element with refs.              |

---

## Menus

Dedicated commands for the macOS menu bar (distinct from in-app UI elements).

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac menu <path>`                             | Click a menu item by path: `"File > Export > PDF"`.        |
| `ac menu list`                               | List all top-level menu bar items for the active app.      |
| `ac menu list <name>`                        | List items under a specific menu (e.g. `"File"`).          |
| `ac menu list --all`                         | Recursively list the entire menu hierarchy.                |
| `ac menubar`                                 | List status bar / menu extras (right side of menu bar).    |
| `ac menubar click <name>`                    | Click a menu bar extra by name or owner.                   |

---

## Clipboard

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac clipboard`                               | Read the current clipboard text.                           |
| `ac clipboard set <text>`                    | Set the clipboard to the given text.                       |
| `ac clipboard copy`                          | Simulate Cmd+C (copy current selection).                   |
| `ac clipboard paste`                         | Simulate Cmd+V (paste clipboard contents).                 |

---

## Wait & Poll

| Command                                             | Description                                                    |
|-----------------------------------------------------|----------------------------------------------------------------|
| `ac wait <sel>`                                     | Wait for an element to exist and be visible.                   |
| `ac wait <sel> --hidden`                            | Wait for an element to disappear / become hidden.              |
| `ac wait <sel> --enabled`                           | Wait for an element to become enabled.                         |
| `ac wait <ms>`                                      | Wait for a fixed duration (milliseconds).                      |
| `ac wait --text <substring>`                        | Wait for text to appear anywhere in the active window.         |
| `ac wait --text <substring> --gone`                 | Wait for text to disappear.                                    |
| `ac wait --app <name>`                              | Wait for an application to launch and be ready.                |
| `ac wait --window <title>`                          | Wait for a window with the given title to appear.              |

All wait commands respect `--timeout`.

---

## Displays

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac displays`                                | List all connected displays with resolution and position.  |

> **Spaces (deferred to a later version):** macOS does not provide a public API for Space/virtual desktop management. Commands like `ac spaces`, `ac spaces switch`, and `ac spaces move` are planned for a future version pending evaluation of private CGS APIs and their stability across macOS releases.

---

## Dock

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac dock`                                    | List all Dock items.                                       |
| `ac dock launch <name>`                      | Launch an app from the Dock.                               |
| `ac dock right-click <name>`                 | Right-click a Dock item (shows context menu).              |

---

## Recording

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac record start [path]`                     | Start recording the screen to a video file. Auto-generates path if omitted. |
| `ac record stop`                             | Stop recording and finalize the video file.                |
| `ac record status`                           | Check if a recording is in progress and its duration.      |

Output format is `.mp4` by default. Recordings capture the grabbed window, or the full screen if no window is grabbed.

---

## Batch Mode

Pipe a JSON array of commands to execute sequentially, reducing process startup overhead.

```bash
echo '[["click","@b1"],["type","Hello"],["key","enter"]]' | ac batch
```

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac batch`                                   | Read commands from stdin (JSON array of argument arrays).  |
| `ac batch --bail`                            | Stop on first error (default: continue and report all).    |

Each command in the array returns its result; the overall output is a JSON array of results. Exit code is `0` if all commands succeed, or the exit code of the first failure when using `--bail`.

---

## Diff & Compare

| Command                                              | Description                                                          |
|------------------------------------------------------|----------------------------------------------------------------------|
| `ac changed`                                         | Quick boolean check: has the UI changed since the last snapshot?     |
| `ac diff snapshot`                                   | Compare current snapshot vs. the last snapshot.                      |
| `ac diff snapshot --baseline <path>`                 | Compare current snapshot vs. a saved baseline file.                  |
| `ac diff screenshot --baseline <path>`               | Visual pixel diff of current screenshot vs. baseline.                |
| `ac diff screenshot --baseline <path> -o <path>`     | Save the diff image to a file.                                       |
| `ac diff screenshot --baseline <path> -t <threshold>`| Color threshold for diff sensitivity (0–1).                          |

---

## Notifications & Dialogs

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac alert`                                   | Get the text/buttons of a currently visible system alert.  |
| `ac alert accept [text]`                     | Click the default / accept button (optionally fill text).  |
| `ac alert dismiss`                           | Click the cancel / dismiss button.                         |
| `ac dialog`                                  | Detect current dialog type and list its elements.          |
| `ac dialog file <path>`                      | Fill in a file path in a save/open dialog.                 |
| `ac dialog click <button_label>`             | Click a button in a dialog by label.                       |
| `ac dialog fill <sel> <text>`                | Fill a text field within a dialog.                         |
| `ac notify <text>`                           | Post a macOS notification (useful for agent status).       |

---

## Daemon

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac daemon start`                            | Start the background daemon for snapshot caching and faster response. |
| `ac daemon stop`                             | Stop the background daemon.                                |
| `ac daemon status`                           | Check if the daemon is running and show uptime/stats.      |
| `ac daemon restart`                          | Restart the daemon.                                        |

The daemon is optional. When running, the CLI automatically connects to it for faster AX queries and snapshot caching. When not running, the CLI falls back to direct AX queries.

---

## Permissions & Setup

| Command                                      | Description                                                |
|----------------------------------------------|------------------------------------------------------------|
| `ac permissions`                             | Show current permission status (Accessibility, Screen Recording). |
| `ac permissions grant`                       | Open the relevant System Settings pane for granting access.|
| `ac doctor`                                  | Run diagnostics: check permissions, daemon status, test snapshot, report version. |
| `ac version`                                 | Print version.                                             |

---

## Configuration

| Command                               | Description                                                |
|---------------------------------------|------------------------------------------------------------|
| `ac config`                           | Show current configuration.                                |
| `ac config set <key> <value>`         | Set a config value (e.g. `default-timeout`, `screenshot-dir`). |
| `ac config reset`                     | Reset to defaults.                                         |

Config file location: `~/.config/ac/config.json`

| Config Key           | Default   | Description                            |
|----------------------|-----------|----------------------------------------|
| `default-timeout`    | `10000`   | Default wait/action timeout in ms.     |
| `screenshot-dir`     | `/tmp/ac` | Default directory for screenshots.     |
| `screenshot-format`  | `png`     | Default screenshot format.             |
| `retina`             | `false`   | Always capture at 2× by default.       |
| `content-boundary`   | `false`   | Always wrap output in boundary markers.|
| `daemon-idle-timeout`| `300000`  | Daemon self-terminates after this many ms of inactivity (default: 5 min). |

Environment variables (override config):

| Variable              | Description                            |
|-----------------------|----------------------------------------|
| `AC_TIMEOUT`          | Default timeout in ms.                 |
| `AC_SCREENSHOT_DIR`   | Default screenshot output directory.   |
| `AC_JSON`             | Set to `1` for JSON output.            |
| `AC_VERBOSE`          | Set to `1` for debug logging.          |

---

## Typical Agent Workflow

```bash
# 1. Discover what's running
agent-computer apps --running

# 2. Grab a window to work with
agent-computer windows
agent-computer grab @w1

# 3. Understand the UI
agent-computer snapshot -i
# Output:
# [@w1] Window "My App"
#   [@g1] Group "Toolbar"
#     [@b1] Button "New Document" (enabled, 10,44 120×28)
#     [@d3] PopUpButton "Format" value="Plain Text" (enabled, 140,44 100×28)
#   [@g2] Group "Content"
#     *[@t2] TextArea "Editor" value="" (focused, 0,72 800×600)
#     [@l4] Link "Help" (enabled, 700,44 40×16)

# 4. Interact
agent-computer click @b1
agent-computer fill @t2 "Hello, world!"
agent-computer menu "Format > Make Rich Text"
agent-computer key cmd+s

# 5. Verify
agent-computer snapshot -i
agent-computer screenshot ~/Desktop/result.png

# 6. Release context
agent-computer ungrab
```

---

## Design Notes

### Why not just use Peekaboo?

Peekaboo is excellent and the heaviest inspiration here. `ac` differs in philosophy:

1. **CLI-only, no AI built in.** `agent-computer` is a dumb tool — it doesn't bundle LLM calls or agent loops. The agent (Claude Code, custom scripts, etc.) calls `ac` as a tool. This keeps the CLI fast, simple, and provider-agnostic.

2. **Stateful grab model.** The `grab` / `ungrab` pattern reduces token cost by not requiring a window ref on every command. For agents making 20+ calls per task, this adds up.

3. **Typed refs.** Knowing `@b3` is a button before inspecting it helps agents plan actions without re-reading the snapshot. Peekaboo uses opaque element IDs.

4. **agent-browser parity.** Agents already trained on agent-browser's command vocabulary (`click`, `fill`, `snapshot`, `wait`, `scroll`) can transfer to `ac` with minimal prompt changes.

### Implementation Notes

- **Language:** Swift (required for AXUIElement, CGEvent, and ScreenCaptureKit APIs).
- **Permission model:** Accessibility + Screen Recording. `ac doctor` checks both.
- **Daemon optional:** A background daemon (managed via `ac daemon start/stop/status`) enables snapshot caching and faster response. The CLI can work without it (direct AX queries) but will be slower for complex UIs.
- **Electron apps:** Accessibility trees for Electron apps can be empty or shallow. `ac snapshot` should fall back to OCR when the AX tree yields < 5 elements, and flag this in the output (`"fallback": "ocr"`).
- **Ref stability:** Refs are assigned per-snapshot and cached in `~/.ac/snapshots/<id>/`. They are NOT stable across snapshots — agents must re-snapshot after any UI-changing action.
- **Exit codes:** `0` = success, `1` = element not found, `2` = permission denied, `3` = timeout, `4` = app not found, `5` = window not found, `126` = general error.
