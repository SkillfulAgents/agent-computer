# `ac` — Multi-Platform Architecture

> Agent Computer: a cross-platform desktop automation CLI for AI agents.

## Overview

`ac` is a single npm package that provides a unified CLI and TypeScript SDK for desktop automation across macOS and Windows. The command surface is identical on both platforms — agents don't need to know which OS they're running on.

**Phase 1:** macOS (Swift native binary). **Phase 2 (immediate follow-up):** Windows (C# / .NET native binary). Cross-platform support is a core differentiator — the architecture is designed from day one to accommodate both, but macOS ships first.

```
npm install -g @datawizz/ac
ac snapshot -i     # works on macOS and Windows, same output format
```

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     npm: @datawizz/ac                        │
│                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │   CLI (TS)     │  │   SDK (TS)       │  │  MCP Server   │ │
│  │   bin/ac.ts    │  │   src/index.ts   │  │  (future)     │ │
│  └───────┬────────┘  └────────┬─────────┘  └──────┬───────┘ │
│          │                    │                    │          │
│          ▼                    ▼                    ▼          │
│  ┌───────────────────────────────────────────────────────┐   │
│  │              Bridge Layer (src/bridge.ts)              │   │
│  │                                                       │   │
│  │  - Resolves platform binary (darwin/win32)            │   │
│  │  - Manages daemon lifecycle (spawn, health, restart)  │   │
│  │  - Sends commands via JSON-RPC over socket/named pipe  │   │
│  │  - Falls back to exec-per-command if daemon is down   │   │
│  │  - Normalizes output across platforms                 │   │
│  └───────────────────┬───────────────────────────────────┘   │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │  Unix socket / named pipe (daemon mode)
                       │  — or —
                       │  exec + JSON stdout (one-shot mode)
          ┌────────────┴────────────────┐
          ▼                             ▼
┌───────────────────┐         ┌───────────────────┐
│  ac-core (macOS)  │         │  ac-core (Windows) │
│  Swift binary     │         │  C# / .NET binary  │
│                   │         │                    │
│  - AXUIElement    │         │  - UI Automation   │
│  - CGEvent        │         │  - SendInput       │
│  - ScreenCapture  │         │  - Desktop Dup API │
│    Kit            │         │  - Shell automation │
│  - AppKit/Cocoa   │         │  - Win32 APIs      │
│  - Quartz Window  │         │                    │
│    Services       │         │                    │
└───────────────────┘         └───────────────────┘
   Universal binary              x64 + arm64
   (arm64 + x86_64)              .exe
```

---

## Package Structure

```
@datawizz/ac/
│
├── package.json
├── tsconfig.json
│
├── bin/
│   └── ac.ts                    # CLI entry point (#!/usr/bin/env node)
│
├── src/
│   ├── index.ts                 # Public SDK: ac.snapshot(), ac.click(), etc.
│   ├── types.ts                 # Shared types: Ref, Snapshot, Window, Element, etc.
│   ├── bridge.ts                # Platform binary management + IPC
│   ├── daemon.ts                # Daemon lifecycle (spawn, ping, shutdown)
│   ├── refs.ts                  # Ref parsing/validation (@b1 → { type: "button", id: 1 })
│   ├── errors.ts                # Typed errors (NotFound, PermissionDenied, Timeout, etc.)
│   └── platform/
│       ├── resolve.ts           # Binary resolution logic per platform/arch
│       ├── darwin.ts            # macOS-specific path resolution & permission checks
│       └── win32.ts             # Windows-specific path resolution
│
├── platforms/                   # Native binaries (downloaded on postinstall or committed)
│   ├── darwin-arm64/
│   │   └── ac-core              # Swift universal binary
│   ├── darwin-x64/
│   │   └── ac-core              # (or single universal binary symlinked)
│   ├── win32-x64/
│   │   └── ac-core.exe          # .NET self-contained publish
│   └── win32-arm64/
│       └── ac-core.exe
│
├── native/
│   ├── macos/                   # Swift source
│   │   ├── Package.swift
│   │   └── Sources/
│   │       └── ACCore/
│   │           ├── main.swift
│   │           ├── Protocol.swift       # JSON-RPC message types
│   │           ├── Daemon.swift         # Unix domain socket JSON-RPC server
│   │           ├── Snapshot.swift       # AX tree walking + ref assignment
│   │           ├── Actions.swift        # Click, type, scroll via CGEvent
│   │           ├── Find.swift           # Element search by text/role
│   │           ├── Windows.swift        # Window enumeration + management
│   │           ├── Apps.swift           # App launch, quit, list
│   │           ├── Menus.swift          # Menu bar + menu extras
│   │           ├── Capture.swift        # ScreenCaptureKit screenshots
│   │           ├── Recording.swift      # Screen recording to video
│   │           ├── Clipboard.swift      # NSPasteboard
│   │           ├── Dialog.swift         # Alert + file dialog handling
│   │           ├── Batch.swift          # Sequential command execution
│   │           ├── Permissions.swift    # AX trust check + Screen Recording
│   │           └── OCRFallback.swift    # Vision framework OCR for Electron apps
│   │
│   └── windows/                 # C# / .NET source
│       ├── ACCore.csproj
│       └── src/
│           ├── Program.cs
│           ├── Protocol.cs              # JSON-RPC message types (shared schema)
│           ├── Daemon.cs                # Named pipe JSON-RPC server
│           ├── Snapshot.cs              # UIA tree walking + ref assignment
│           ├── Actions.cs               # Click, type, scroll via UIA patterns + SendInput
│           ├── Find.cs                  # Element search by text/role
│           ├── Windows.cs               # Window enumeration + management
│           ├── Apps.cs                  # Process launch, kill, list
│           ├── Menus.cs                 # UIA menu walking (per-app, no global bar)
│           ├── Capture.cs               # Desktop Duplication API / Graphics.CopyFromScreen
│           ├── Recording.cs             # Screen recording to video
│           ├── Clipboard.cs             # Win32 clipboard
│           ├── Dialog.cs                # Alert + file dialog handling
│           ├── Batch.cs                 # Sequential command execution
│           └── OCRFallback.cs           # Windows.Media.Ocr
│
├── scripts/
│   ├── build-macos.sh           # swift build -c release --arch arm64 --arch x86_64
│   ├── build-windows.ps1        # dotnet publish -c Release -r win-x64 --self-contained
│   ├── postinstall.ts           # Download or verify platform binary
│   └── ci-build-all.sh          # Cross-platform CI (GitHub Actions matrix)
│
└── test/
    ├── unit/                    # TS unit tests (bridge, refs, types)
    ├── integration/             # Cross-platform integration tests
    │   ├── snapshot.test.ts
    │   ├── click.test.ts
    │   └── ...
    └── fixtures/                # Test apps (SwiftUI + WPF) for CI
```

---

## IPC Protocol

The TS bridge communicates with the native binary via **JSON-RPC 2.0 over Unix domain sockets** (macOS) or **named pipes** (Windows).

### Two Modes

| Mode | When | How |
|------|------|-----|
| **Daemon** (preferred) | Long-running agent sessions | Binary started once with `ac daemon start` or auto-spawned by bridge. Listens on a Unix domain socket (`~/.ac/daemon.sock` on macOS) or named pipe (`\\.\pipe\ac-daemon` on Windows). Multiple CLI/SDK processes connect to the same daemon. Keeps snapshot cache warm. ~5ms per command. |
| **One-shot** (fallback) | Single commands, CI, scripting | Binary spawned per command with args. JSON result on stdout. ~80ms per command (process startup overhead). |

The bridge automatically manages the daemon — starts it on first call, pings it for health, restarts if it dies. The daemon can also be managed explicitly via `ac daemon start/stop/status/restart`.

### Request

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "snapshot",
  "params": {
    "interactive": true,
    "depth": 3,
    "window": "@w1"        // optional, uses grabbed window if omitted
  }
}
```

### Response (success)

Elements are returned as a hierarchical tree via nested `children`. The currently focused element has `"focused": true`.

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "snapshot_id": "a1b2c3d4",
    "window": { "ref": "@w1", "title": "Untitled", "app": "TextEdit", "bounds": [0, 0, 800, 600] },
    "elements": [
      {
        "ref": "@g1", "role": "group", "label": "Toolbar", "enabled": true, "focused": false,
        "bounds": [0, 0, 800, 40],
        "children": [
          { "ref": "@b1", "role": "button", "label": "Save", "enabled": true, "focused": false, "bounds": [120, 40, 80, 24] },
          { "ref": "@d1", "role": "dropdown", "label": "Language", "value": "English", "enabled": true, "focused": false, "bounds": [400, 40, 150, 24] }
        ]
      },
      {
        "ref": "@g2", "role": "group", "label": "Content", "enabled": true, "focused": false,
        "bounds": [0, 40, 800, 560],
        "children": [
          { "ref": "@t1", "role": "textarea", "label": "Editor", "value": "Hello...", "enabled": true, "focused": true, "bounds": [0, 64, 800, 500] }
        ]
      }
    ],
    "fallback": null       // or "ocr" if AX tree was insufficient
  }
}
```

### Response (error)

```jsonc
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,         // see error codes below
    "message": "Element not found",
    "data": { "ref": "@b99", "snapshot_id": "a1b2c3d4" }
  }
}
```

### Error Codes

| Code | Name | Exit Code (one-shot) |
|------|------|---------------------|
| `-32001` | `ELEMENT_NOT_FOUND` | `1` |
| `-32002` | `PERMISSION_DENIED` | `2` |
| `-32003` | `TIMEOUT` | `3` |
| `-32004` | `APP_NOT_FOUND` | `4` |
| `-32005` | `WINDOW_NOT_FOUND` | `5` |
| `-32006` | `INVALID_REF` | `6` |
| `-32007` | `OCR_FALLBACK_FAILED` | `7` |
| `-32600` | `INVALID_REQUEST` | `126` |
| `-32601` | `METHOD_NOT_FOUND` | `126` |
| `-32602` | `INVALID_PARAMS` | `126` |

---

## TypeScript SDK

The SDK is a thin async wrapper over the bridge. Every method returns a typed Promise.

```typescript
import { ac } from '@datawizz/ac';

// Session
await ac.grab({ app: 'Safari' });

// Observe
const snap = await ac.snapshot({ interactive: true });
// snap.elements → Element[]  (hierarchical tree with children)

const img = await ac.screenshot({ retina: true });
// img.path → string

// Act
await ac.click('@b1');
await ac.click('@b1', { wait: true });        // wait for element before clicking
await ac.click('@b1', { human: true });       // human-like cursor movement
await ac.fill('@t2', 'Hello, world!');
await ac.type('Hello', { human: true });      // human-like typing cadence
await ac.key('cmd+s');
await ac.scroll('down', { on: '@g3', amount: 5 });
await ac.menu('File > Export > PDF');

// Find
const btns = await ac.find('Submit', { role: 'button' });
const first = await ac.find('Save', { first: true });

// Wait
await ac.wait('@b1', { timeout: 5000 });
await ac.wait({ text: 'Save successful' });

// Inspect
const val = await ac.read('@t2');
const visible = await ac.is.visible('@b1');
const box = await ac.box('@b1');
const changed = await ac.changed();           // quick UI change check

// Dialogs
const dlg = await ac.dialog();
await ac.dialog.file('~/Documents/report.pdf');
await ac.dialog.click('Save');

// Record
await ac.record.start('/tmp/session.mp4');
await ac.record.stop();

// Batch
const results = await ac.batch([
  ['click', '@b1'],
  ['type', 'Hello'],
  ['key', 'enter'],
]);

// Daemon management
await ac.daemon.status();

// Cleanup
await ac.ungrab();
await ac.shutdown(); // stops the daemon
```

### Type Definitions (excerpt)

```typescript
// types.ts

// Single-letter prefixes for common roles, two-letter for rare roles
export type RefPrefix =
  | 'b' | 't' | 'l' | 'm' | 'c' | 'r' | 's' | 'd' | 'i' | 'g' | 'w' | 'x' | 'o' | 'a' | 'e'
  | 'cb' | 'sa' | 'st' | 'sp' | 'tl' | 'pg' | 'tv' | 'wb';
export type Ref = `@${RefPrefix}${number}`;

export interface Element {
  ref: Ref;
  role: string;           // normalized: "button", "textfield", "link", etc.
  label: string | null;
  value: string | null;
  enabled: boolean;
  focused: boolean;
  bounds: [x: number, y: number, w: number, h: number];
  children?: Element[];   // hierarchical tree; present if depth allows
}

export interface Snapshot {
  snapshot_id: string;
  window: WindowInfo;
  elements: Element[];    // top-level elements (each may have nested children)
  fallback: 'ocr' | null;
}

export interface WindowInfo {
  ref: Ref;
  title: string;
  app: string;
  bundle_id?: string;     // macOS
  process_id: number;
  bounds: [x: number, y: number, w: number, h: number];
  minimized: boolean;
  hidden: boolean;
  fullscreen: boolean;
}

export interface ScreenshotResult {
  path: string;
  width: number;
  height: number;
  annotations?: Array<{ ref: Ref; label: string; bounds: [number, number, number, number] }>;
}

export interface RecordingStatus {
  active: boolean;
  path?: string;
  duration_ms?: number;
}

export interface DialogInfo {
  type: 'alert' | 'file-open' | 'file-save' | 'custom';
  message?: string;
  buttons: string[];
  elements: Element[];
}
```

---

## Platform Abstraction

The native binaries implement the same JSON-RPC method set. Platform differences are hidden behind a normalized interface.

### Capability Matrix

| Feature | macOS (Swift) | Windows (C# / .NET) | Notes |
|---------|--------------|---------------------|-------|
| **Snapshot** | AXUIElement tree walk | UIA tree walk (ControlView) | Same output shape |
| **Click** | CGEvent posting + AXPress | UIA InvokePattern + SendInput | |
| **Type** | CGEvent key events | SendInput key events | |
| **Fill** | AXValue set + CGEvent | UIA ValuePattern.SetValue | |
| **Scroll** | CGEvent scroll wheel | UIA ScrollPattern + SendInput wheel | |
| **Drag** | CGEvent mouse down/move/up | SendInput mouse events | |
| **Screenshot** | ScreenCaptureKit | Desktop Duplication API | |
| **Window list** | CGWindowListCopyWindowInfo | EnumWindows + UIA | |
| **Window mgmt** | AXUIElement (AXRaise, AXMinimize, etc.) | SetWindowPos + ShowWindow | |
| **App launch** | NSWorkspace.open | Process.Start | |
| **App list (installed)** | LSCopyApplicationURLs / Spotlight | Registry + Start Menu scan | |
| **App list (running)** | NSWorkspace.runningApplications | Process.GetProcesses | |
| **Menu bar** | AXUIElement menu bar walk | UIA menu walk (per-app) | No global menu bar on Windows |
| **Menu extras / Tray** | CGWindow + AX for status items | Shell_NotifyIcon / UIA SystemTray | Different paradigm |
| **Clipboard** | NSPasteboard | Win32 Clipboard API | |
| **Virtual desktops** | Deferred (private CGS APIs) | Deferred (IVirtualDesktopManager COM) | Planned for future version |
| **Find** | AX tree search by label/role | UIA FindAll with conditions | |
| **Dialog** | AX on frontmost window + file dialog | UIA on modal windows + file dialog | |
| **Recording** | AVFoundation / ScreenCaptureKit | Desktop Duplication + FFmpeg | |
| **Batch** | Sequential command dispatch | Sequential command dispatch | Shared logic in native binary |
| **OCR fallback** | Vision framework (VNRecognizeTextRequest) | Windows.Media.Ocr | |
| **Permissions** | AXIsProcessTrusted + Screen Recording | Not required (UIA is open) | |
| **Alert/dialog** | AX on frontmost window | UIA on modal windows | |

### Platform-Specific Behavior

Most commands work identically on both platforms. Differences are noted below.

| Command | macOS | Windows | Notes |
|---------|-------|---------|-------|
| `ac menu <path>` | ✅ Global menu bar | ✅ Per-app menu bar (UIA) | Different underlying model, same CLI surface |
| `ac menubar` | ✅ Status items | ✅ System tray icons | Different paradigm, normalized output |
| `ac dock` | ✅ Dock | ✅ Taskbar (alias: `ac taskbar`) | `ac dock` is the canonical command on all platforms. On Windows, `ac taskbar` is accepted as an alias. |
| `ac permissions` | ✅ AX + Screen Recording | ✅ (always passes) | Windows doesn't need grants |

---

## Binary Distribution

### Strategy: Platform-Specific Optional Dependencies

Follow the pattern used by `esbuild`, `swc`, `turbo`, and `@rollup/rollup`:

```jsonc
// package.json
{
  "name": "@datawizz/ac",
  "version": "0.1.0",
  "bin": { "ac": "./bin/ac.js" },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "optionalDependencies": {
    "@datawizz/ac-darwin-arm64": "0.1.0",
    "@datawizz/ac-darwin-x64": "0.1.0",
    "@datawizz/ac-win32-x64": "0.1.0",
    "@datawizz/ac-win32-arm64": "0.1.0"
  }
}
```

Each platform package contains just the binary:

```jsonc
// @datawizz/ac-darwin-arm64/package.json
{
  "name": "@datawizz/ac-darwin-arm64",
  "version": "0.1.0",
  "os": ["darwin"],
  "cpu": ["arm64"],
  "files": ["bin/ac-core"]
}
```

npm automatically installs only the matching `optionalDependency` based on `os` and `cpu` filters. No postinstall scripts, no downloads — just the right binary.

### Resolution Logic

```typescript
// src/platform/resolve.ts

import { platform, arch } from 'os';
import { join } from 'path';

const PLATFORM_MAP: Record<string, string> = {
  'darwin-arm64':  '@datawizz/ac-darwin-arm64',
  'darwin-x64':    '@datawizz/ac-darwin-x64',
  'win32-x64':     '@datawizz/ac-win32-x64',
  'win32-arm64':   '@datawizz/ac-win32-arm64',
};

export function resolveBinary(): string {
  const key = `${platform()}-${arch()}`;
  const pkg = PLATFORM_MAP[key];
  if (!pkg) throw new Error(`Unsupported platform: ${key}`);

  try {
    const pkgDir = require.resolve(`${pkg}/package.json`);
    const ext = platform() === 'win32' ? '.exe' : '';
    return join(pkgDir, '..', 'bin', `ac-core${ext}`);
  } catch {
    throw new Error(
      `Native binary not found for ${key}. ` +
      `Run: npm install ${pkg}`
    );
  }
}
```

---

## Build & CI

### GitHub Actions Matrix

```yaml
name: Build Native Binaries

on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-14           # Apple Silicon runner
    steps:
      - uses: actions/checkout@v4
      - name: Build universal binary
        run: |
          cd native/macos
          swift build -c release --arch arm64 --arch x86_64
          # Produces universal binary at .build/apple/Products/Release/ac-core
      - name: Sign binary with Developer ID
        env:
          DEVELOPER_ID: ${{ secrets.APPLE_DEVELOPER_ID_APPLICATION }}
        run: |
          codesign --force --options runtime \
            --sign "$DEVELOPER_ID" \
            --entitlements native/macos/ac-core.entitlements \
            --identifier "ai.datawizz.ac-core" \
            .build/apple/Products/Release/ac-core
      - name: Notarize binary
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
        run: |
          # Create a zip for notarization
          ditto -c -k --keepParent .build/apple/Products/Release/ac-core ac-core.zip
          xcrun notarytool submit ac-core.zip \
            --apple-id "$APPLE_ID" \
            --team-id "$APPLE_TEAM_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --wait
          # Staple is not possible for bare binaries (only .app/.pkg/.dmg),
          # but notarization still allows Gatekeeper to verify online
      - name: Package for npm
        run: |
          mkdir -p packages/ac-darwin-arm64/bin
          mkdir -p packages/ac-darwin-x64/bin
          cp .build/apple/Products/Release/ac-core packages/ac-darwin-arm64/bin/
          cp .build/apple/Products/Release/ac-core packages/ac-darwin-x64/bin/

  build-windows:
    strategy:
      matrix:
        include:
          - rid: win-x64
            pkg: ac-win32-x64
          - rid: win-arm64
            pkg: ac-win32-arm64
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0'
      - name: Build
        run: |
          cd native/windows
          dotnet publish -c Release -r ${{ matrix.rid }} --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=true
      - name: Package for npm
        run: |
          mkdir -p packages/${{ matrix.pkg }}/bin
          cp native/windows/bin/Release/net9.0/${{ matrix.rid }}/publish/ac-core.exe packages/${{ matrix.pkg }}/bin/

  publish:
    needs: [build-macos, build-windows]
    runs-on: ubuntu-latest
    steps:
      - name: Publish all packages to npm
        run: |
          for pkg in ac ac-darwin-arm64 ac-darwin-x64 ac-win32-x64 ac-win32-arm64; do
            cd packages/$pkg && npm publish --access public && cd ../..
          done
```

### Entitlements (macOS)

```xml
<!-- native/macos/ac-core.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.automation.apple-events</key>
  <true/>
</dict>
</plist>
```

**Note on permissions:** Accessibility and Screen Recording are TCC (Transparency, Consent, and Control) runtime prompts — they do not require entitlements in the binary. The OS prompts the user on first use. However, the binary must have an embedded Info.plist (linked into `__TEXT/__info_plist`) with:
- `CFBundleIdentifier` — for the OS to track permission grants
- `NSAccessibilityUsageDescription` — shown in the Accessibility permission prompt
- `NSScreenCaptureUsageDescription` — shown in the Screen Recording permission prompt (required by ScreenCaptureKit)

The `com.apple.security.automation.apple-events` entitlement is needed for sending Apple Events (e.g. launching/quitting apps via NSWorkspace scripting bridge).

### CI Testing

Integration tests run on a dedicated CI machine with a physical display connected. The macOS runner has Accessibility and Screen Recording permissions pre-granted for the test harness. Test fixture apps (SwiftUI for macOS, WPF for Windows Phase 2) provide deterministic UI surfaces for snapshot and interaction testing.

---

## Daemon Lifecycle

The daemon runs as a background process, listening on a Unix domain socket (macOS: `~/.ac/daemon.sock`) or named pipe (Windows: `\\.\pipe\ac-daemon`). Multiple CLI/SDK processes connect to the same daemon concurrently.

```
┌──────────────────────────────────────────────────┐
│             Bridge (TS) or CLI                    │
│                                                   │
│  1. First call (auto-start) or `ac daemon start`  │
│     → Check: is daemon alive? (connect to socket) │
│     → No: spawn `ac-core --daemon`                │
│     → Daemon writes socket path to ~/.ac/daemon.json │
│     → Wait for socket to accept connections       │
│                                                   │
│  2. Send command as JSON-RPC over socket           │
│     → Read JSON-RPC response from socket           │
│     → Multiple clients can connect concurrently    │
│                                                   │
│  3. On daemon crash / timeout                     │
│     → Respawn automatically                       │
│     → Retry the failed command once               │
│                                                   │
│  4. On `ac daemon stop` or `ac.shutdown()`        │
│     → Send "shutdown" method over socket           │
│     → Daemon cleans up socket file and exits      │
│                                                   │
│  5. Idle timeout (config: daemon-idle-timeout,    │
│     default 5min / 300000ms)                      │
│     → Daemon self-terminates if no connections    │
│     → Cleans up socket file on exit               │
│     → Bridge respawns on next call                │
└──────────────────────────────────────────────────┘
```

### Daemon Management Commands

| Command | Description |
|---------|-------------|
| `ac daemon start` | Start the daemon (if not already running). |
| `ac daemon stop` | Stop the daemon gracefully. |
| `ac daemon status` | Show daemon PID, uptime, connected clients, cached snapshots. |
| `ac daemon restart` | Stop and restart the daemon. |

### Daemon State

The daemon stores:
- **Grabbed window context** — persisted across commands from any connected client.
- **Last snapshot** — cached elements and refs for fast ref resolution.
- **Snapshot history** — ring buffer of last 10 snapshots for `diff` and `changed`.

The daemon's PID, socket path, and start time are stored in `~/.ac/daemon.json` so multiple CLI invocations can discover and reuse the same daemon. On startup, the daemon checks for stale PID files (process no longer running) and cleans them up.

---

## Snapshot Normalization

Both platforms produce the same `Element` shape. The native binaries handle the mapping:

### macOS AX → Normalized Role

| AXRole | Normalized |
|--------|-----------|
| AXButton | `button` |
| AXTextField | `textfield` |
| AXTextArea | `textarea` |
| AXLink | `link` |
| AXCheckBox | `checkbox` |
| AXRadioButton | `radio` |
| AXSlider | `slider` |
| AXPopUpButton | `dropdown` |
| AXImage | `image` |
| AXGroup | `group` |
| AXWindow | `window` |
| AXTable | `table` |
| AXRow / AXCell | `row` / `cell` |
| AXTabGroup | `tabgroup` |
| AXTab | `tab` |
| AXMenuBar | `menubar` |
| AXMenuItem | `menuitem` |
| AXScrollArea | `scrollarea` |
| AXStaticText | `text` |
| AXComboBox | `combobox` |
| AXStepper | `stepper` |
| AXSplitGroup | `splitgroup` |
| AXTimeline | `timeline` |
| AXProgressIndicator | `progress` |
| AXOutline | `treeview` |
| AXWebArea | `webarea` |
| (other) | `generic` |

### Windows UIA → Normalized Role

| UIA ControlType | Normalized |
|----------------|-----------|
| Button | `button` |
| Edit | `textfield` |
| Document | `textarea` |
| Hyperlink | `link` |
| CheckBox | `checkbox` |
| RadioButton | `radio` |
| Slider | `slider` |
| ComboBox | `dropdown` |
| Image | `image` |
| Group / Pane | `group` |
| Window | `window` |
| Table / DataGrid | `table` |
| DataItem / TreeItem | `row` |
| Tab / TabItem | `tabgroup` / `tab` |
| MenuBar | `menubar` |
| MenuItem | `menuitem` |
| ScrollBar (parent) | `scrollarea` |
| Text | `text` |
| (other) | `generic` |

### Ref Assignment

Refs are assigned during tree walk by the native binary, using the role → prefix mapping. Common roles use single-letter prefixes; less common roles use two-letter prefixes to avoid collisions:

```
normalized role → prefix → counter
button          → @b     → @b1, @b2, @b3
textfield       → @t     → @t1, @t2
link            → @l     → @l1, @l2
combobox        → @cb    → @cb1, @cb2
scrollarea      → @sa    → @sa1
stepper         → @st    → @st1
splitgroup      → @sp    → @sp1
timeline        → @tl    → @tl1
progress        → @pg    → @pg1
treeview        → @tv    → @tv1
webarea         → @wb    → @wb1
generic         → @e     → @e1, @e2  (fallback for unmapped roles)
...
```

Counters are per-prefix, per-snapshot. The native binary stores the ref → AX/UIA element mapping in memory so subsequent `click @b3` calls resolve instantly without re-walking the tree.

---

## OCR Fallback Strategy

Some apps (especially Electron-based: VS Code, Slack, Notion, Discord) may return empty or shallow accessibility trees. The native binary detects this and falls back to OCR.

### Detection Heuristic

```
IF snapshot tree has < 5 interactive elements
AND the window screenshot has visible UI elements (via edge detection)
THEN trigger OCR fallback
```

### OCR Pipeline

1. **Capture** the window screenshot (ScreenCaptureKit on macOS, Desktop Dup on Windows).
2. **Run OCR** (Vision framework on macOS, Windows.Media.Ocr on Windows).
3. **Detect interactive regions** — use heuristics (rectangular shapes, text near clickable-looking areas) or a lightweight vision model.
4. **Emit elements** with `"source": "ocr"` flag and coordinate-based refs.
5. **Set** `"fallback": "ocr"` in the snapshot response so the agent knows precision may be lower.

OCR-sourced elements use coordinate-based clicking rather than AX/UIA element handles.

---

## Security Considerations

- **Permission escalation:** `ac` can control any app the user can interact with. The npm package should document this clearly. On macOS, Accessibility and Screen Recording permissions are required and gated by the OS. On Windows, no special permissions are needed — document this risk.
- **Content boundaries:** The `--content-boundary` flag wraps all output in delimiters so LLMs can distinguish tool output from untrusted app content (e.g. a webpage containing text that looks like a command).
- **No remote access:** The daemon listens only on a local Unix domain socket (`~/.ac/daemon.sock`) or named pipe. The socket file has user-only permissions (0700). There is no TCP socket, no HTTP server, no remote attack surface.
- **Snapshot data:** Snapshots may contain sensitive information (email subjects, document text, form values). Snapshots are stored in `~/.ac/snapshots/` with user-only permissions (0700). They are automatically pruned after 1 hour.
- **Clipboard:** The `paste` command saves and restores the clipboard. The `clipboard set` command replaces it. Agents should be cautious about overwriting user clipboard contents.

---

## Future: MCP Server

An MCP (Model Context Protocol) server will expose `ac` capabilities as MCP tools, enabling direct integration with MCP-compatible AI clients (e.g. Claude Desktop) without shell invocation. The MCP server will be a thin wrapper over the same bridge layer used by the CLI and SDK, connecting to the shared daemon.

Planned for a future version after the CLI and SDK are stable.

---

## Future: Linux Support

Linux desktop automation is fragmented across display servers:

| Display Server | Accessibility | Input Simulation |
|---------------|--------------|-----------------|
| X11 | AT-SPI2 (D-Bus based, mature) | XTest extension, xdotool |
| Wayland | AT-SPI2 (works, but compositor-dependent) | Compositor-specific (no universal input injection) |

A Linux binary (`ac-core-linux`) could target AT-SPI2 for the accessibility tree and `xdotool` / `ydotool` for input. However, Wayland's security model intentionally prevents apps from injecting input into other apps — which is the core of what `ac` does. This makes a universal Linux implementation significantly harder than macOS or Windows.

**Recommendation:** Defer Linux to v2. Most agent workloads targeting Linux run in headless containers where GUI automation isn't relevant. If needed, `xdotool` + AT-SPI2 on X11 covers the common server-with-VNC case.
