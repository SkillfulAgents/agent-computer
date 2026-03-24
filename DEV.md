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
