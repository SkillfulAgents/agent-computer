# Local Development

## Setup

```bash
npm install
```

## Building

```bash
# TypeScript only
npm run build

# Swift daemon only
npm run build:swift

# Both
npm run build:all
```

### Windows daemon

`npm run build:dotnet` is a plain framework-dependent build for local iteration
and CI tests. Shipping binaries are produced with `dotnet publish -r <rid>`, and
`ACCore.csproj` turns every RID publish into a **single self-contained
`ac-core.exe`** — the npm package and release zips ship only that one file, so a
multi-file publish would leave behind an apphost stub that fails with
`The application to execute does not exist: ...ac-core.dll` (surfacing in
clients as `Daemon pipe did not become available within 5000ms`).

```powershell
# Publish win-x64 + win-arm64 and verify each is one runnable file
npm run build:dotnet:publish

# Also copy into bin/ac-core-win32-<arch>.exe so resolveBinary() picks it up
powershell -File scripts/build-windows.ps1 -Stage

# One architecture only
powershell -File scripts/build-windows.ps1 -Rid win-arm64 -Stage
```

Requires the .NET 9 SDK (`winget install Microsoft.DotNet.SDK.9`). Expect
~12 MB per exe; the build script fails above 20 MB.

Keep the Windows daemon free of `UseWPF` / `UseWindowsForms`. UI Automation
goes through the UIAutomationCore COM API behind a small managed shim
(`ACCore/Uia/Uia.cs`, same shape as `System.Windows.Automation`), and
screens / clipboard / the halo overlay are plain Win32 (`Screens.cs`,
`Clipboard.cs`, `Overlay.cs`). Referencing the WindowsDesktop framework pulls
~40 MB of WPF into a self-contained publish and the trimmer cannot remove it —
that is how 0.0.12 shipped 70 MB binaries.

## Running locally

```bash
# Direct TS execution (no build needed, best for iterating)
alias agent-computer="npx tsx bin/ac.ts"

# Or use compiled JS (requires npm run build)
alias agent-computer="node dist/bin/ac.js"
```

## Daemon management

```bash
agent-computer daemon start      # Start daemon
agent-computer daemon stop       # Stop daemon
agent-computer daemon restart    # Restart (picks up new Swift binary)
agent-computer daemon status     # Check if running
```

After changing Swift code, rebuild and restart:

```bash
npm run build:swift && agent-computer daemon restart
```

TS changes via `tsx` are picked up immediately (no restart needed).

## Tests

```bash
npm test                # Unit + contract tests
npm run test:unit       # Unit tests only
npm run test:functional # Functional tests (needs macOS, launches apps)
npm run test:e2e        # E2E tests (120s timeout)
npm run test:all        # Everything
npm run test:watch      # Watch mode (unit + contract)
```

## Typecheck

```bash
npm run typecheck
```

## Debugging

```bash
AC_VERBOSE=1 agent-computer snapshot   # Daemon stderr logged
```
