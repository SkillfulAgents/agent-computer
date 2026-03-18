# AGENTS.md — Agent Development Guide for `ac`

## How to work on this project

1. Read the test file for your assigned feature FIRST.
2. Run the tests — they will fail. That's expected.
3. Implement until tests pass.
4. Do NOT modify test files unless explicitly asked.
5. Run `npm run test:contract && npm run test:unit` before committing.
6. If you need to add a new RPC method, create the schema file first.

## Key files to understand
- `schema/` — JSON schemas for all RPC messages (source of truth)
- `src/bridge.ts` — how TS talks to the native binary
- `src/types.ts` — all TypeScript types
- `src/refs.ts` — ref parsing, validation, prefix mappings
- `native/macos/Sources/ACCore/` — Swift native binary source
- `native/macos/Sources/ACCore/Roles.swift` — AX role normalization, RefAssigner

## Running tests
- `npm test` — fast (contract + unit, any OS)
- `npm run test:integration` — needs the native binary built
- `npm run test:functional` — needs binary + test app + accessibility permissions
- `npm run test:all` — run everything

## Building
- `npm run build` — compile TypeScript
- `npm run build:swift` — build Swift binary (release mode)
- `cd native/macos && swift build` — build Swift binary (debug mode)

## Common patterns
- Look at existing commands (e.g., `click`) for the full path: schema → Swift → bridge → SDK → CLI
- Every command returns JSON-RPC. Errors use the codes in `src/errors.ts`.
- Refs look like `@b1`, `@t2`, `@cb1`, etc. See `src/refs.ts` for the prefix table.
- Snapshots are hierarchical trees by default. Use `children` to navigate the tree.

## Flakiness rules
- Never use `sleep()` in functional tests. Use `ac.wait()` for specific conditions.
- If a test fails intermittently, re-run it once before investigating.
- If it passes on retry, report as flaky — do NOT modify your implementation.
