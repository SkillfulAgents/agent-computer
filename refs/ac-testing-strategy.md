# `ac` — Testing Strategy

> Comprehensive, multi-level testing plan for building `ac` with high reliability
> and agent-driven semi-autonomous TDD development.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Pyramid](#2-test-pyramid)
3. [Level 0 — Contract Tests (Schema Validation)](#3-level-0--contract-tests)
4. [Level 1 — Unit Tests (TypeScript)](#4-level-1--unit-tests-typescript)
5. [Level 2 — Unit Tests (Native Binaries)](#5-level-2--unit-tests-native-binaries)
6. [Level 3 — Integration Tests (Bridge ↔ Binary)](#6-level-3--integration-tests)
7. [Level 4 — Functional Tests (Real App Automation)](#7-level-4--functional-tests)
8. [Level 5 — Snapshot Fidelity Tests](#8-level-5--snapshot-fidelity-tests)
9. [Level 6 — Cross-Platform Parity Tests](#9-level-6--cross-platform-parity-tests)
10. [Level 7 — Stress & Reliability Tests](#10-level-7--stress--reliability-tests)
11. [Level 8 — Agent Workflow Tests (End-to-End)](#11-level-8--agent-workflow-tests)
12. [Test Fixtures — Synthetic Test Apps](#12-test-fixtures--synthetic-test-apps)
13. [CI Pipeline](#13-ci-pipeline)
14. [Agent-Driven Development Workflow](#14-agent-driven-development-workflow)
15. [Coverage & Quality Gates](#15-coverage--quality-gates)
16. [Test File Structure](#16-test-file-structure)

---

## 1. Testing Philosophy

### Core Principles

**Reliability is the product.** If an agent uses `ac click @b3` and the wrong button gets clicked, or nothing happens silently, the entire agent loop breaks. Every command must either succeed deterministically or fail with a precise, typed error. There is no acceptable middle ground.

**Tests are the spec.** Since agents are developing this project semi-autonomously, test files serve as the authoritative specification. An agent picks up a task, reads the test file, and implements until tests pass. The tests are written *first* and are more detailed than the architecture docs.

**Contract-first across boundaries.** The TS ↔ native binary boundary is the riskiest seam in the system. A shared JSON schema (tested independently on both sides) ensures the TS bridge and native binaries agree on every message format, even when developed by different agents or in different languages.

**Real apps, not mocks, for functional tests.** Mocking the accessibility API defeats the purpose. We build minimal synthetic test apps (SwiftUI on macOS, WPF on Windows) with known, deterministic UI elements and test against those. These test apps are as much a part of the project as the CLI itself.

**Hermetic by default, real by necessity.** Unit tests and contract tests run anywhere (CI, local, any OS). Functional tests require the target OS with permissions granted — they run on dedicated CI machines with physical displays and pre-configured accessibility permissions.

**Side-channel verification.** Functional tests must NOT use `ac` to verify that `ac` commands worked. If `ac snapshot` is broken, using it to read back the test app status makes every test fail — the agent can't tell what's actually wrong. Instead, the test app writes its state to a file (`/tmp/ac-test-status.txt`) that tests read directly. A few dedicated tests verify snapshot reads the status bar correctly, but the rest use the file side-channel.

**Flakiness is the enemy of agent development.** GUI tests are inherently flaky. An agent cannot distinguish "my code is wrong" from "the test is timing-dependent." All functional tests must use `ac wait` for conditions instead of `sleep()`. Tests at L0-L3 must have 0% flake rate. Tests at L4-L5 must be < 2% flaky. Tests at L6-L8 may be up to 5% flaky and support one automatic retry.

### Test-Driven Development for Agent Workers

Each feature follows this cycle:

```
1. Human/lead builds or extends the test app fixture (committed separately)
2. Human/lead writes the test file (committed — tests fail)
3. Agent reads the test file (it fails — nothing is implemented yet)
4. Agent implements the feature until all tests pass
5. Agent runs the broader test suite to check for regressions
6. Human reviews the diff
```

**Fixture-first rule:** Test fixtures (test app UI elements) must exist and be committed *before* the feature test file. This ensures the agent can run the test and see it fail at the assertion level, not at setup. If a feature requires new test app tabs/elements, that is a separate prerequisite task.

The test files contain enough context (comments, expected output examples, fixture descriptions) that an agent can implement the feature without additional conversation.

---

## 2. Test Pyramid

```
                    ╱╲
                   ╱  ╲         Level 8: Agent Workflow E2E (5-10 scenarios)
                  ╱    ╲        Full multi-step agent loops against real apps
                 ╱──────╲
                ╱        ╲      Level 7: Stress & Reliability (10-15 tests)
               ╱          ╲     Rapid-fire commands, daemon crash recovery, race conditions
              ╱────────────╲
             ╱              ╲   Level 6: Cross-Platform Parity (30-40 assertions)
            ╱                ╲  Same scenarios on macOS + Windows, output diffed
           ╱──────────────────╲
          ╱                    ╲ Level 5: Snapshot Fidelity (20-30 tests)
         ╱                      ╲ Snapshot output validated against known UI structures
        ╱────────────────────────╲
       ╱                          ╲ Level 4: Functional Tests (80-120 tests)
      ╱                            ╲ Real commands against synthetic test apps
     ╱──────────────────────────────╲
    ╱                                ╲ Level 3: Integration (30-50 tests)
   ╱                                  ╲ TS bridge ↔ native binary, daemon lifecycle
  ╱────────────────────────────────────╲
 ╱                                      ╲ Level 2: Native Unit Tests (80-120 tests)
╱                                        ╲ Swift + C# internal logic (tree walk, ref assignment, etc.)
╱──────────────────────────────────────────╲
╱                                            ╲ Level 1: TS Unit Tests (60-80 tests)
╱──────────────────────────────────────────────╲ Ref parsing, bridge logic, CLI arg parsing, type guards
╱────────────────────────────────────────────────╲
╱                                                  ╲ Level 0: Contract Tests (40-60 assertions)
╱────────────────────────────────────────────────────╲ JSON schema validation on both sides of the bridge
```

**Total: ~400-600 tests at maturity.**

Run times:
- Level 0-2: < 10 seconds (run on every save)
- Level 3: < 30 seconds (run on every commit)
- Level 4-5: < 3 minutes (run on every PR)
- Level 6-8: < 10 minutes (run on merge to main, nightly)

---

## 3. Level 0 — Contract Tests

**Purpose:** Ensure the TS bridge and native binaries agree on message format at all times. This is the single most important test level — a schema mismatch causes silent, hard-to-debug failures.

### Shared Schema

A single source of truth: `schema/` directory containing JSON Schema files for every RPC method.

```
schema/
├── methods/
│   ├── snapshot.request.json
│   ├── snapshot.response.json
│   ├── click.request.json
│   ├── click.response.json
│   ├── fill.request.json
│   ├── fill.response.json
│   ├── screenshot.request.json
│   ├── screenshot.response.json
│   ├── windows.request.json
│   ├── windows.response.json
│   ├── ...                         # one pair per RPC method
│   └── error.response.json
├── types/
│   ├── element.json                # Element shape (ref, role, label, value, bounds, etc.)
│   ├── window-info.json            # WindowInfo shape
│   ├── ref.json                    # Ref format regex pattern
│   └── normalized-role.json        # Enum of all normalized roles
└── examples/
    ├── snapshot.response.example.json
    ├── click.response.example.json
    └── ...
```

### TS-Side Contract Tests

```typescript
// test/contract/schema-validation.test.ts

import Ajv from 'ajv';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ajv = new Ajv({ allErrors: true, strict: true });
const SCHEMA_DIR = join(__dirname, '../../schema');

// Load all schemas
const schemas = loadAllSchemas(SCHEMA_DIR);

describe('Contract: JSON Schema Validation', () => {

  // Every example file must validate against its schema
  describe('examples validate against schemas', () => {
    for (const example of getAllExamples()) {
      test(`${example.name} matches ${example.schemaName}`, () => {
        const validate = ajv.compile(schemas[example.schemaName]);
        const valid = validate(example.data);
        expect(valid).toBe(true);
        if (!valid) console.error(validate.errors);
      });
    }
  });

  // Ref format: must be @<prefix><number> (single or two-letter prefix)
  test('ref pattern accepts valid single-letter refs', () => {
    const refSchema = schemas['ref'];
    const validate = ajv.compile(refSchema);
    expect(validate('@b1')).toBe(true);
    expect(validate('@t23')).toBe(true);
    expect(validate('@w1')).toBe(true);
    expect(validate('@e100')).toBe(true);
  });

  test('ref pattern accepts valid two-letter refs', () => {
    const refSchema = schemas['ref'];
    const validate = ajv.compile(refSchema);
    expect(validate('@cb1')).toBe(true);     // combobox
    expect(validate('@sa2')).toBe(true);     // scroll area
    expect(validate('@st3')).toBe(true);     // stepper
    expect(validate('@sp1')).toBe(true);     // split group
    expect(validate('@pg1')).toBe(true);     // progress
    expect(validate('@tv1')).toBe(true);     // tree view
    expect(validate('@wb1')).toBe(true);     // web area
    expect(validate('@tl5')).toBe(true);     // timeline
  });

  test('ref pattern rejects invalid refs', () => {
    const refSchema = schemas['ref'];
    const validate = ajv.compile(refSchema);
    expect(validate('b1')).toBe(false);      // missing @
    expect(validate('@z1')).toBe(false);      // invalid prefix
    expect(validate('@b')).toBe(false);       // missing number
    expect(validate('@b0')).toBe(false);      // zero not allowed
    expect(validate('@@b1')).toBe(false);     // double @
    expect(validate('@b-1')).toBe(false);     // negative
    expect(validate('@zz1')).toBe(false);     // invalid two-letter prefix
  });

  // Normalized role enum: must be one of the defined set
  test('normalized roles are a closed set', () => {
    const roleSchema = schemas['normalized-role'];
    const EXPECTED_ROLES = [
      'button', 'textfield', 'textarea', 'link', 'checkbox', 'radio',
      'slider', 'dropdown', 'image', 'group', 'window', 'table', 'row',
      'cell', 'tabgroup', 'tab', 'menubar', 'menuitem', 'scrollarea',
      'text', 'toolbar', 'combobox', 'stepper', 'splitgroup', 'timeline',
      'progress', 'treeview', 'webarea', 'generic'
    ];
    const validate = ajv.compile(roleSchema);
    for (const role of EXPECTED_ROLES) {
      expect(validate(role)).toBe(true);
    }
    expect(validate('foobar')).toBe(false);
  });

  // Error response shape
  test('error response has required fields', () => {
    const validate = ajv.compile(schemas['error.response']);
    expect(validate({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32001, message: 'Element not found', data: { ref: '@b99' } }
    })).toBe(true);
  });
});
```

### Swift-Side Contract Tests

```swift
// native/macos/Tests/ContractTests/SchemaTests.swift

import XCTest
import Foundation

final class SchemaContractTests: XCTestCase {

    let schemaDir = URL(fileURLWithPath: #file)
        .deletingLastPathComponent()
        .appendingPathComponent("../../../../schema")

    /// Load a schema and validate an example against it
    func testSnapshotResponseMatchesSchema() throws {
        let example = try loadJSON("examples/snapshot.response.example.json")
        let schema = try loadJSON("methods/snapshot.response.json")
        try assertValidatesAgainstSchema(instance: example, schema: schema)
    }

    func testClickResponseMatchesSchema() throws {
        let example = try loadJSON("examples/click.response.example.json")
        let schema = try loadJSON("methods/click.response.json")
        try assertValidatesAgainstSchema(instance: example, schema: schema)
    }

    func testElementShapeHasRequiredFields() throws {
        let element: [String: Any] = [
            "ref": "@b1",
            "role": "button",
            "label": "Save",
            "enabled": true,
            "focused": false,
            "bounds": [120, 40, 80, 24]
        ]
        let schema = try loadJSON("types/element.json")
        try assertValidatesAgainstSchema(instance: element, schema: schema)
    }

    func testRefFormatValidation() throws {
        // Test that the ref encoder produces valid refs
        let refs = RefAssigner()
        let ref1 = refs.assign(role: .button)      // @b1
        let ref2 = refs.assign(role: .textField)    // @t1
        let ref3 = refs.assign(role: .button)       // @b2

        XCTAssertEqual(ref1, "@b1")
        XCTAssertEqual(ref2, "@t1")
        XCTAssertEqual(ref3, "@b2")

        // Validate format against schema regex
        let pattern = try loadSchemaPattern("types/ref.json")
        for ref in [ref1, ref2, ref3] {
            XCTAssertTrue(ref.matches(pattern), "\(ref) should match ref pattern")
        }
    }

    func testNormalizedRoleMapping() throws {
        // Every AXRole we handle must map to a valid normalized role
        let roleSchema = try loadJSON("types/normalized-role.json")
        let allowedRoles = try extractEnum(from: roleSchema)

        for (axRole, normalized) in AXRoleMapper.allMappings {
            XCTAssertTrue(
                allowedRoles.contains(normalized),
                "AXRole \(axRole) maps to '\(normalized)' which is not in the schema enum"
            )
        }
    }
}
```

### C#-Side Contract Tests

Identical structure in `native/windows/Tests/ContractTests/`, validating the same schema files from the same `schema/` directory.

**Key rule:** The `schema/` directory is the *only* shared artifact between TS, Swift, and C#. If a schema changes, all three contract test suites must be updated and pass before merge.

### Schema Evolution Rules

Schemas will evolve as features are added. To avoid breaking existing consumers:

| Change Type | Allowed? | Contract Test Impact |
|---|---|---|
| **Add optional field** to a response (e.g., `hidden?: boolean` on `WindowInfo`) | ✅ Additive | Old responses still validate. New tests added for the new field. Schemas must use `"additionalProperties": true` or omit `"required"` for the new field. |
| **Add new enum value** to normalized roles (e.g., `"combobox"`) | ✅ Additive | Existing validators pass. New value added to the `EXPECTED_ROLES` list in tests. |
| **Add new RPC method** (e.g., `find`) | ✅ Additive | New schema files created. No impact on existing schemas. |
| **Remove a field** from a response | ❌ Breaking | Requires major version bump. All contract tests on all platforms updated simultaneously. |
| **Change a field's type** | ❌ Breaking | Same as above. |
| **Rename a field** | ❌ Breaking | Same as above. |

**Rule for agents:** When adding a new field to an existing response type, add it as *optional* in the JSON schema (`"required"` must NOT include it initially). Add tests that validate the field is present in *new* responses, but don't break validation of responses that omit it.

---

## 4. Level 1 — Unit Tests (TypeScript)

**Purpose:** Test the TS layer in isolation — no native binary needed. These run on any OS.

### Areas

| Area | Examples | Count |
|------|----------|-------|
| Ref parsing | `parseRef('@b3')` → `{ prefix: 'b', type: 'button', id: 3 }` | 15-20 |
| Ref validation | `isValidRef('@b3')` → true, `isValidRef('b3')` → false | 10-15 |
| CLI arg parsing | `parseArgs(['click', '@b3', '--right'])` → correct command object | 15-20 |
| Bridge message construction | `buildRequest('click', { ref: '@b3' })` → valid JSON-RPC | 10-15 |
| Bridge response parsing | Parse JSON-RPC responses, extract result or throw typed error | 10-15 |
| Error mapping | JSON-RPC error code → typed TS error class | 8-10 |
| Config resolution | Env vars override config file override defaults | 5-8 |
| Platform resolution | `resolveBinary()` on darwin-arm64 → correct path | 4-6 |

### Example

```typescript
// test/unit/refs.test.ts

import { parseRef, isValidRef, refToRole, REF_PREFIXES } from '../src/refs';

describe('Ref Parsing', () => {

  test.each([
    ['@b1', { prefix: 'b', role: 'button', id: 1 }],
    ['@t23', { prefix: 't', role: 'textfield', id: 23 }],
    ['@l3', { prefix: 'l', role: 'link', id: 3 }],
    ['@e100', { prefix: 'e', role: 'generic', id: 100 }],
    ['@w1', { prefix: 'w', role: 'window', id: 1 }],
    ['@cb1', { prefix: 'cb', role: 'combobox', id: 1 }],
    ['@sa2', { prefix: 'sa', role: 'scrollarea', id: 2 }],
    ['@pg5', { prefix: 'pg', role: 'progress', id: 5 }],
  ])('parseRef(%s) → %o', (input, expected) => {
    expect(parseRef(input)).toEqual(expected);
  });

  test.each([
    'b1', '@@b1', '@z1', '@b', '@b0', '@b-1', '', '@B1', '@ b1'
  ])('parseRef(%s) throws', (input) => {
    expect(() => parseRef(input)).toThrow();
  });

  test('every prefix maps to a role', () => {
    for (const [prefix, role] of Object.entries(REF_PREFIXES)) {
      expect(refToRole(prefix)).toBe(role);
    }
  });
});
```

```typescript
// test/unit/bridge.test.ts

import { buildRequest, parseResponse, BridgeError } from '../src/bridge';

describe('Bridge Message Construction', () => {

  test('buildRequest creates valid JSON-RPC', () => {
    const msg = buildRequest('click', { ref: '@b3' });
    expect(msg).toMatchObject({
      jsonrpc: '2.0',
      method: 'click',
      params: { ref: '@b3' },
    });
    expect(typeof msg.id).toBe('number');
    expect(msg.id).toBeGreaterThan(0);
  });

  test('buildRequest increments id', () => {
    const msg1 = buildRequest('snapshot', {});
    const msg2 = buildRequest('click', { ref: '@b1' });
    expect(msg2.id).toBe(msg1.id + 1);
  });
});

describe('Bridge Response Parsing', () => {

  test('parseResponse extracts result on success', () => {
    const raw = {
      jsonrpc: '2.0', id: 1,
      result: { snapshot_id: 'abc', elements: [] }
    };
    expect(parseResponse(raw)).toEqual(raw.result);
  });

  test('parseResponse throws BridgeError on error response', () => {
    const raw = {
      jsonrpc: '2.0', id: 1,
      error: { code: -32001, message: 'Element not found', data: { ref: '@b99' } }
    };
    expect(() => parseResponse(raw)).toThrow(BridgeError);
    try { parseResponse(raw); } catch (e) {
      expect((e as BridgeError).code).toBe(-32001);
      expect((e as BridgeError).name).toBe('ELEMENT_NOT_FOUND');
    }
  });

  test('parseResponse throws on malformed response', () => {
    expect(() => parseResponse({})).toThrow();
    expect(() => parseResponse({ jsonrpc: '2.0' })).toThrow();
    expect(() => parseResponse(null)).toThrow();
  });
});
```

---

## 5. Level 2 — Unit Tests (Native Binaries)

**Purpose:** Test the Swift and C# internals without launching real apps or requiring accessibility permissions.

### Swift (XCTest)

| Area | Examples | Count |
|------|----------|-------|
| Ref assignment | Counter logic, prefix mapping, reset between snapshots | 15-20 |
| Role normalization | AXRole → normalized role for every known role | 20-25 |
| Tree serialization | AXUIElement mock → JSON Element array | 10-15 |
| JSON-RPC parsing | Parse incoming request, validate params | 10-15 |
| JSON-RPC response construction | Build response with correct structure | 8-10 |
| Coordinate math | Bounds normalization, screen ↔ window coords | 5-8 |
| Permission checking | AXIsProcessTrusted mock (returns true/false) | 3-5 |
| OCR text extraction | Vision framework with test image fixtures | 5-8 |
| Daemon message framing | Newline-delimited JSON parsing, partial reads | 5-8 |

### Testing AX Without Real Apps

The AX layer should be abstracted behind a protocol so it can be mocked in tests:

```swift
// Sources/ACCore/Protocols/AccessibilityProvider.swift

protocol AccessibilityProvider {
    func runningApplications() -> [AppInfo]
    func windows(for pid: pid_t) -> [WindowInfo]
    func elementTree(for window: WindowHandle, depth: Int?) -> AXNode
    func performAction(_ action: AXAction, on element: ElementHandle) -> Result<Void, ACError>
    func setValue(_ value: String, on element: ElementHandle) -> Result<Void, ACError>
}

// Sources/ACCore/Providers/LiveAccessibilityProvider.swift
// → Real implementation using AXUIElement

// Tests/Mocks/MockAccessibilityProvider.swift
// → Returns pre-built trees for testing
```

```swift
// Tests/UnitTests/SnapshotTests.swift

final class SnapshotTests: XCTestCase {

    func testRefAssignmentByRole() {
        let tree = AXNode.window(title: "Test", children: [
            .button(label: "Save"),
            .button(label: "Cancel"),
            .textField(label: "Name", value: ""),
            .button(label: "OK"),
        ])

        let mock = MockAccessibilityProvider(tree: tree)
        let snapshot = SnapshotBuilder(provider: mock).build(interactive: false)

        XCTAssertEqual(snapshot.elements[0].ref, "@b1")  // Save
        XCTAssertEqual(snapshot.elements[1].ref, "@b2")  // Cancel
        XCTAssertEqual(snapshot.elements[2].ref, "@t1")  // Name
        XCTAssertEqual(snapshot.elements[3].ref, "@b3")  // OK
    }

    func testInteractiveFilterExcludesStaticText() {
        let tree = AXNode.window(title: "Test", children: [
            .staticText(value: "Hello"),        // not interactive
            .button(label: "OK"),               // interactive
            .group(children: [
                .staticText(value: "Label"),    // not interactive
                .textField(label: "Input"),     // interactive
            ])
        ])

        let mock = MockAccessibilityProvider(tree: tree)
        let snapshot = SnapshotBuilder(provider: mock).build(interactive: true)

        XCTAssertEqual(snapshot.elements.count, 2)
        XCTAssertEqual(snapshot.elements[0].ref, "@b1")
        XCTAssertEqual(snapshot.elements[1].ref, "@t1")
    }

    func testDepthLimiting() {
        let tree = AXNode.window(title: "Test", children: [
            .group(children: [
                .group(children: [
                    .group(children: [
                        .button(label: "Deep")  // depth 4
                    ])
                ])
            ])
        ])

        let mock = MockAccessibilityProvider(tree: tree)
        let snapshot2 = SnapshotBuilder(provider: mock).build(depth: 2)
        let snapshot4 = SnapshotBuilder(provider: mock).build(depth: 4)

        XCTAssertEqual(snapshot2.elements.filter { $0.role == "button" }.count, 0)
        XCTAssertEqual(snapshot4.elements.filter { $0.role == "button" }.count, 1)
    }

    func testRefCountersResetBetweenSnapshots() {
        let mock = MockAccessibilityProvider(tree: .window(title: "T", children: [.button(label: "A")]))

        let snap1 = SnapshotBuilder(provider: mock).build()
        let snap2 = SnapshotBuilder(provider: mock).build()

        XCTAssertEqual(snap1.elements[0].ref, "@b1")
        XCTAssertEqual(snap2.elements[0].ref, "@b1")  // reset, not @b2
        XCTAssertNotEqual(snap1.snapshot_id, snap2.snapshot_id)
    }
}
```

### C# (xUnit)

Mirror structure, testing the same logic against UIA mocks:

```csharp
// native/windows/Tests/UnitTests/SnapshotTests.cs

public class SnapshotTests
{
    [Fact]
    public void RefAssignment_ButtonsGetBPrefix()
    {
        var tree = new MockUIANode("Window", "Test", children: new[] {
            new MockUIANode("Button", "Save"),
            new MockUIANode("Button", "Cancel"),
            new MockUIANode("Edit", "Name"),
        });

        var snapshot = new SnapshotBuilder(new MockUIAProvider(tree)).Build();

        Assert.Equal("@b1", snapshot.Elements[0].Ref);
        Assert.Equal("@b2", snapshot.Elements[1].Ref);
        Assert.Equal("@t1", snapshot.Elements[2].Ref);
    }
}
```

---

## 6. Level 3 — Integration Tests

**Purpose:** Test the TS bridge communicating with the *real* native binary. These spawn the actual binary but may or may not interact with real apps.

### Daemon Lifecycle Tests

The daemon communicates via Unix domain socket (macOS) or named pipe (Windows). Tests must verify socket lifecycle, multi-client access, and crash recovery.

```typescript
// test/integration/daemon.test.ts

import { Bridge } from '../src/bridge';
import { existsSync, statSync } from 'fs';

const SOCKET_PATH = join(homedir(), '.ac/daemon.sock');
const DAEMON_JSON = join(homedir(), '.ac/daemon.json');

describe('Daemon Lifecycle', () => {
  let bridge: Bridge;

  afterEach(async () => {
    await bridge?.shutdown();
  });

  test('daemon starts on first command and creates socket', async () => {
    bridge = new Bridge();
    expect(bridge.isRunning()).toBe(false);
    await bridge.send('status', {});
    expect(bridge.isRunning()).toBe(true);

    // Socket file should exist with user-only permissions
    expect(existsSync(SOCKET_PATH)).toBe(true);
    const stat = statSync(SOCKET_PATH);
    expect(stat.mode & 0o777).toBe(0o700);
  });

  test('daemon writes PID file', async () => {
    bridge = new Bridge();
    await bridge.send('ping', {});
    expect(existsSync(DAEMON_JSON)).toBe(true);
    const info = JSON.parse(readFileSync(DAEMON_JSON, 'utf-8'));
    expect(info).toHaveProperty('pid');
    expect(info).toHaveProperty('socket');
    expect(info).toHaveProperty('started_at');
    expect(processExists(info.pid)).toBe(true);
  });

  test('daemon responds to ping', async () => {
    bridge = new Bridge();
    const res = await bridge.send('ping', {});
    expect(res).toMatchObject({ pong: true });
  });

  test('second bridge connects to existing daemon', async () => {
    bridge = new Bridge();
    await bridge.send('ping', {});
    const pid1 = bridge.daemonPid();

    const bridge2 = new Bridge();
    await bridge2.send('ping', {});
    const pid2 = bridge2.daemonPid();

    // Both should talk to the same daemon
    expect(pid2).toBe(pid1);
    await bridge2.disconnect(); // disconnect without shutdown
  });

  test('daemon restarts after crash and cleans up stale socket', async () => {
    bridge = new Bridge();
    await bridge.send('ping', {});

    // Kill the daemon process
    bridge._killDaemonProcess();

    // Next command should detect dead socket, clean up, and auto-restart
    const res = await bridge.send('ping', {});
    expect(res).toMatchObject({ pong: true });
  });

  test('daemon shuts down cleanly and removes socket', async () => {
    bridge = new Bridge();
    await bridge.send('ping', {});
    const pid = bridge.daemonPid();
    await bridge.shutdown();
    expect(processExists(pid)).toBe(false);
    expect(existsSync(SOCKET_PATH)).toBe(false);
  });

  test('daemon cleans up stale PID file on startup', async () => {
    // Write a stale daemon.json pointing to a non-existent PID
    writeFileSync(DAEMON_JSON, JSON.stringify({ pid: 99999999, socket: SOCKET_PATH }));

    bridge = new Bridge();
    const res = await bridge.send('ping', {});
    expect(res).toMatchObject({ pong: true });

    // Should have replaced the stale file
    const info = JSON.parse(readFileSync(DAEMON_JSON, 'utf-8'));
    expect(info.pid).not.toBe(99999999);
  });

  test('concurrent commands from multiple clients', async () => {
    bridge = new Bridge();
    const bridge2 = new Bridge();

    const results = await Promise.all([
      bridge.send('ping', {}),
      bridge2.send('ping', {}),
      bridge.send('ping', {}),
      bridge2.send('ping', {}),
    ]);
    expect(results).toHaveLength(4);
    results.forEach(r => expect(r).toMatchObject({ pong: true }));
    await bridge2.disconnect();
  });

  test('command timeout produces TIMEOUT error', async () => {
    bridge = new Bridge({ timeout: 50 });  // 50ms timeout
    await expect(bridge.send('sleep', { ms: 200 }))
      .rejects.toThrow(/TIMEOUT/);
  });

  test('daemon handles malformed data on socket without crashing', async () => {
    bridge = new Bridge();
    await bridge.send('ping', {});

    // Send garbage directly to socket
    bridge._sendRawToSocket('not valid json\n');

    // Daemon should still be alive
    const res = await bridge.send('ping', {});
    expect(res).toMatchObject({ pong: true });
  });
});
```

### One-Shot Mode Tests

```typescript
// test/integration/one-shot.test.ts

import { execFileSync } from 'child_process';
import { resolveBinary } from '../src/platform/resolve';

const BINARY = resolveBinary();

describe('One-Shot Mode', () => {

  test('returns valid JSON for status command', () => {
    const output = execFileSync(BINARY, ['status'], { encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('jsonrpc', '2.0');
    expect(parsed).toHaveProperty('result');
  });

  test('returns error JSON for unknown method', () => {
    const output = execFileSync(BINARY, ['nonexistent'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(output);
    expect(parsed.error.code).toBe(-32601); // METHOD_NOT_FOUND
  });

  test('exit code 2 for permission denied', () => {
    // This test is platform-conditional — only meaningful if AX permission is revoked
    // Skipped in CI where permissions are pre-granted
  });

  test('version flag returns semver', () => {
    const output = execFileSync(BINARY, ['--version'], { encoding: 'utf-8' }).trim();
    expect(output).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

### Grab/Ungrab State Tests

```typescript
// test/integration/grab.test.ts

describe('Grab State Management', () => {

  test('grab sets active window', async () => {
    const windows = await ac.windows();
    await ac.grab(windows[0].ref);
    const status = await ac.status();
    expect(status.grabbed_window).toBe(windows[0].ref);
  });

  test('ungrab clears active window', async () => {
    const windows = await ac.windows();
    await ac.grab(windows[0].ref);
    await ac.ungrab();
    const status = await ac.status();
    expect(status.grabbed_window).toBeNull();
  });

  test('commands after grab use grabbed window', async () => {
    // Requires a real window — see Level 4
  });

  test('grab invalid ref returns WINDOW_NOT_FOUND', async () => {
    await expect(ac.grab('@w999'))
      .rejects.toThrow(/WINDOW_NOT_FOUND/);
  });
});
```

---

## 7. Level 4 — Functional Tests

**Purpose:** Test real commands against the synthetic test apps. This is where we verify that `ac click @b1` actually clicks a button and produces a state change.

### Test App Fixtures (see Section 12 for details)

Each platform has a purpose-built test app:

- **macOS:** SwiftUI app (`ACTestApp`) with tabs for each UI control type
- **Windows:** WPF app (`ACTestApp.exe`) mirroring the same layout

Both apps expose a status bar / label showing the last action that occurred. Crucially, both apps also **write their last action to a file** (`/tmp/ac-test-status.txt`) as a side-channel that tests read directly, avoiding circular dependency on `ac snapshot` for verification.

### Test Structure

```typescript
// test/functional/click.test.ts

import { ac } from '../../src';
import { launchTestApp, killTestApp, readTestAppStatus } from '../helpers/test-app';

describe('Functional: Click', () => {
  beforeAll(async () => {
    await launchTestApp();
    await ac.grab({ app: 'ACTestApp' });
  });

  afterAll(async () => {
    await ac.ungrab();
    await killTestApp();
  });

  beforeEach(async () => {
    // Navigate to the Buttons tab in the test app
    await ac.click({ label: 'Buttons' }); // tab selector
  });

  test('click button by ref', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const saveBtn = snap.elements.find(e => e.label === 'Save');
    expect(saveBtn).toBeDefined();

    await ac.click(saveBtn!.ref);

    // Verify via side-channel (reads file, NOT ac snapshot)
    const status = await readTestAppStatus();
    expect(status).toBe('Button clicked: Save');
  });

  test('click with --wait waits for element to appear', async () => {
    // Trigger async element creation
    await ac.click({ label: 'Show Delayed Button' });

    // Click with --wait: element doesn't exist yet, but will appear in ~500ms
    await ac.click({ label: 'Delayed Button' }, { wait: true, timeout: 3000 });

    const status = await readTestAppStatus();
    expect(status).toBe('Button clicked: Delayed Button');
  });

  test('click with --human has natural cursor movement', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const target = snap.elements.find(e => e.label === 'Save');

    const start = Date.now();
    await ac.click(target!.ref, { human: true });
    const elapsed = Date.now() - start;

    // Human-like click should take slightly longer than instant click
    expect(elapsed).toBeGreaterThan(50);

    const status = await readTestAppStatus();
    expect(status).toBe('Button clicked: Save');
  });

  test('right-click shows context menu', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const target = snap.elements.find(e => e.label === 'Right-Click Target');

    await ac.click(target!.ref, { right: true });

    // Verify via side-channel
    const status = await readTestAppStatus();
    expect(status).toContain('Right-clicked: Right-Click Target');
  });

  test('double-click triggers double-click handler', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const target = snap.elements.find(e => e.label === 'Double-Click Target');

    await ac.click(target!.ref, { double: true });

    const status = await readTestAppStatus();
    expect(status).toBe('Double-clicked: Double-Click Target');
  });

  test('click with modifiers', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const target = snap.elements.find(e => e.label === 'Modifier Target');

    await ac.click(target!.ref, { modifiers: ['shift'] });

    const status = await readTestAppStatus();
    expect(status).toContain('Shift+Click');
  });

  test('click non-existent ref returns ELEMENT_NOT_FOUND', async () => {
    await expect(ac.click('@b999')).rejects.toThrow(/ELEMENT_NOT_FOUND/);
  });

  test('click disabled button returns error', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const disabledBtn = snap.elements.find(e => e.label === 'Disabled Button');
    expect(disabledBtn?.enabled).toBe(false);

    // Should still attempt (some agents want to click disabled things)
    // but the test app status should not change
    const statusBefore = await readTestAppStatus();
    await ac.click(disabledBtn!.ref);
    const statusAfter = await readTestAppStatus();
    expect(statusAfter).toBe(statusBefore);
  });
});
```

```typescript
// test/functional/type.test.ts

describe('Functional: Type & Fill', () => {
  beforeAll(async () => {
    await launchTestApp();
    await ac.grab({ app: 'ACTestApp' });
    await ac.click({ label: 'Text Input' }); // navigate to tab
  });

  test('fill clears and types into a text field', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const nameField = snap.elements.find(e => e.label === 'Name');

    await ac.fill(nameField!.ref, 'Hello Agent');

    const snap2 = await ac.snapshot({ interactive: true });
    const updated = snap2.elements.find(e => e.label === 'Name');
    expect(updated?.value).toBe('Hello Agent');
  });

  test('type appends to existing text', async () => {
    const snap = await ac.snapshot({ interactive: true });
    const nameField = snap.elements.find(e => e.label === 'Prefilled Field');
    expect(nameField?.value).toBe('existing');

    await ac.focus(nameField!.ref);
    await ac.key('cmd+a');  // select all
    await ac.key('right');  // move to end
    await ac.type(' appended');

    const snap2 = await ac.snapshot({ interactive: true });
    const updated = snap2.elements.find(e => e.label === 'Prefilled Field');
    expect(updated?.value).toBe('existing appended');
  });

  test('type with delay has correct timing', async () => {
    const start = Date.now();
    await ac.type('abcde', { delay: 100 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(400); // 5 chars × 100ms ≈ 500ms, with tolerance
    expect(elapsed).toBeLessThan(1000);
  });

  test('type with --human has variable cadence', async () => {
    const start = Date.now();
    await ac.type('Hello, world! This is a test.', { human: true });
    const elapsed = Date.now() - start;
    // Human typing ~60 WPM = ~200ms/char. 28 chars ≈ 5-6s, but with variance.
    expect(elapsed).toBeGreaterThan(1000); // definitely slower than instant
    const status = await readTestAppStatus();
    expect(status).toContain('Hello, world! This is a test.');
  });

  test('fill with --wait waits for element', async () => {
    await ac.click({ label: 'Show Delayed Field' });
    // Field doesn't exist yet
    await ac.fill({ label: 'Delayed Field' }, 'Waited for it', { wait: true, timeout: 3000 });
    const status = await readTestAppStatus();
    expect(status).toContain('Waited for it');
  });
});
```

```typescript
// test/functional/scroll.test.ts

describe('Functional: Scroll', () => {
  beforeAll(async () => {
    await launchTestApp();
    await ac.grab({ app: 'ACTestApp' });
    await ac.click({ label: 'Scroll Area' }); // navigate to tab
  });

  test('scroll down moves content', async () => {
    const snap1 = await ac.snapshot();
    const topItem = snap1.elements.find(e => e.label === 'Item 1');
    const y1 = topItem?.bounds[1];

    await ac.scroll('down', { amount: 5 });

    const snap2 = await ac.snapshot();
    const topItem2 = snap2.elements.find(e => e.label === 'Item 1');
    // Item 1 should have scrolled up (lower y) or disappeared
    if (topItem2) {
      expect(topItem2.bounds[1]).toBeLessThan(y1!);
    }
  });

  test('scroll on specific element targets that scroll area', async () => {
    const snap = await ac.snapshot();
    const scrollArea = snap.elements.find(e => e.label === 'Nested Scroll');

    await ac.scroll('down', { on: scrollArea!.ref, amount: 3 });

    const status = await readTestAppStatus();
    expect(status).toContain('Nested Scroll: scrolled');
  });

  test('scrollto makes element visible', async () => {
    const snap1 = await ac.snapshot();
    const hiddenItem = snap1.elements.find(e => e.label === 'Item 50');
    expect(hiddenItem).toBeUndefined(); // not visible initially

    await ac.scrollto({ label: 'Item 50' });

    const snap2 = await ac.snapshot();
    const nowVisible = snap2.elements.find(e => e.label === 'Item 50');
    expect(nowVisible).toBeDefined();
  });
});
```

### Functional Test Matrix

Each functional area gets its own test file:

| File | Tests | Fixture Tab |
|------|-------|-------------|
| `click.test.ts` | Click, right-click, double-click, modifiers, disabled, coords, `--wait`, `--human` | Buttons |
| `type.test.ts` | Type, fill, clear, delay, special characters, unicode, `--human`, `fill --wait` | Text Input |
| `scroll.test.ts` | Directional, on-element, smooth, scrollto, pixels | Scroll Area |
| `drag.test.ts` | Element-to-element, coords, modifiers, to-app | Drag & Drop |
| `keyboard.test.ts` | Key combos, keydown/keyup, paste, repeat | Keyboard |
| `select.test.ts` | Dropdown selection, checkbox, radio, slider, toggle | Controls |
| `menu.test.ts` | Menu path click, menu list, submenu traversal | (app menu bar) |
| `window.test.ts` | Minimize, maximize, close, move, resize, bounds, raise | (window mgmt) |
| `wait.test.ts` | Wait for element, text, hidden, timeout, app launch | Async |
| `clipboard.test.ts` | Read, write, copy, paste, round-trip | Text Input |
| `screenshot.test.ts` | Capture, annotate, retina, format, path | (any tab) |
| `read.test.ts` | Read value, attr, title, is-visible, is-enabled, box, children | All |
| `alert.test.ts` | Accept, dismiss, read alert text | Dialogs |
| `dialog.test.ts` | Detect dialog type, file path fill, click button, fill text field | Dialogs |
| `find.test.ts` | Find by text, find by role, find with `--first`, find with role+text | All |
| `batch.test.ts` | Sequential execution, error reporting, `--bail` mode | Buttons + Text Input |
| `record.test.ts` | Start recording, stop recording, status check, output file exists | (any tab) |
| `changed.test.ts` | Returns false when UI unchanged, returns true after interaction | Buttons |
| `daemon.test.ts` | Start, stop, status, restart, auto-start on first command | (system-level) |
| `snapshot-hierarchy.test.ts` | Tree structure, parent-child relationships, depth limiting, compact mode | All |

---

## 8. Level 5 — Snapshot Fidelity Tests

**Purpose:** Ensure that snapshots of known UI structures produce the exact expected element list. These are golden-file tests — we capture a "blessed" snapshot and assert future snapshots match.

### Approach

1. Build the test app to a known state (specific tab, specific content).
2. Run `ac snapshot` and save the output as a golden file.
3. On subsequent runs, diff the actual snapshot against the golden file.
4. Differences are either regressions (fail) or intentional changes (update the golden file).

```typescript
// test/fidelity/snapshot-golden.test.ts

import { ac } from '../../src';
import { loadGoldenFile, updateGoldenFile } from '../helpers/golden';

const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

describe('Snapshot Fidelity', () => {

  test('Buttons tab snapshot matches golden file', async () => {
    await navigateToTab('Buttons');
    const snap = await ac.snapshot({ interactive: true });

    const goldenPath = 'test/fidelity/golden/buttons-tab.json';

    if (UPDATE_GOLDEN) {
      updateGoldenFile(goldenPath, snap);
      return;
    }

    const golden = loadGoldenFile(goldenPath);

    // Compare element count
    expect(snap.elements.length).toBe(golden.elements.length);

    // Compare element tree structure (ignoring bounds, which may shift slightly)
    assertTreeStructureMatches(snap.elements, golden.elements);
  });

  test('Text Input tab snapshot matches golden file', async () => {
    // Same pattern...
  });

  // One test per fixture tab
});

// Recursively compare tree structure: refs, roles, labels, children
function assertTreeStructureMatches(actual: Element[], expected: Element[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].ref).toBe(expected[i].ref);
    expect(actual[i].role).toBe(expected[i].role);
    expect(actual[i].label).toBe(expected[i].label);
    expect(actual[i].enabled).toBe(expected[i].enabled);
    // Recursively check children
    if (expected[i].children) {
      expect(actual[i].children).toBeDefined();
      assertTreeStructureMatches(actual[i].children!, expected[i].children!);
    }
  }
}
```

### Hierarchy-Specific Fidelity Tests

Since snapshots default to hierarchical output, fidelity tests must validate tree structure:

```typescript
// test/fidelity/hierarchy.test.ts

describe('Snapshot Hierarchy Fidelity', () => {

  test('toolbar group contains expected children', async () => {
    await navigateToTab('Buttons');
    const snap = await ac.snapshot();
    const toolbar = findInTree(snap.elements, e => e.label === 'Toolbar');
    expect(toolbar).toBeDefined();
    expect(toolbar!.children).toBeDefined();
    expect(toolbar!.children!.map(c => c.role)).toContain('button');
  });

  test('compact mode flattens hierarchy', async () => {
    await navigateToTab('Buttons');
    const snap = await ac.snapshot({ compact: true });
    // In compact mode, no element should have children
    for (const el of snap.elements) {
      expect(el.children).toBeUndefined();
    }
  });

  test('focused element is marked', async () => {
    await navigateToTab('Text Input');
    const nameField = await ac.find('Name', { role: 'textfield', first: true });
    await ac.focus(nameField.ref);
    const snap = await ac.snapshot();
    const focused = findInTree(snap.elements, e => e.focused === true);
    expect(focused).toBeDefined();
    expect(focused!.label).toBe('Name');
  });

  test('depth limiting truncates tree', async () => {
    const snapDeep = await ac.snapshot({ depth: 10 });
    const snapShallow = await ac.snapshot({ depth: 1 });
    // Shallow should have no nested children
    for (const el of snapShallow.elements) {
      expect(el.children).toBeUndefined();
    }
    // Deep should have nested children
    const hasChildren = snapDeep.elements.some(e => e.children && e.children.length > 0);
    expect(hasChildren).toBe(true);
  });
});
```

### Bounds Tolerance

Element bounds may shift by a few pixels across OS versions or display scaling. Fidelity tests compare bounds with a tolerance:

```typescript
function boundsMatch(actual: number[], expected: number[], tolerance = 5): boolean {
  return actual.every((v, i) => Math.abs(v - expected[i]) <= tolerance);
}
```

---

## 9. Level 6 — Cross-Platform Parity Tests

**Purpose:** Ensure that the same `ac` command produces equivalent results on macOS and Windows.

### Approach

Parity tests run the same scenario on both platforms (in CI) and compare the *normalized* output. Since the test apps are built to have identical UI structure, the snapshot element list should match.

```typescript
// test/parity/snapshot-parity.test.ts

// This test is run on BOTH macOS and Windows CI runners.
// After both runs, a CI step diffs the outputs.

describe('Cross-Platform Parity: Snapshot', () => {

  test('Buttons tab produces same element structure', async () => {
    await navigateToTab('Buttons');
    const snap = await ac.snapshot({ interactive: true });

    // Write to a platform-tagged output file
    // Compare by (role, label) tuples — NOT by ref, since tree walk order may differ
    const platform = process.platform;
    const normalized = flattenTree(snap.elements)
      .map(e => ({ role: e.role, label: e.label, enabled: e.enabled }))
      .sort((a, b) => `${a.role}:${a.label}`.localeCompare(`${b.role}:${b.label}`));
    writeParityOutput(`buttons-${platform}.json`, { elements: normalized });
  });
});
```

CI post-step:

```yaml
- name: Diff parity outputs
  run: |
    diff \
      test/parity/output/buttons-darwin.json \
      test/parity/output/buttons-win32.json \
      || (echo "PARITY MISMATCH" && exit 1)
```

### Parity Tolerance

Parity is compared by **(role, label) tuples**, not by ref IDs. macOS and Windows may walk the AX/UIA tree in different orders, producing different ref assignments for the same UI structure. Structural equivalence is what matters.

Some differences are expected and documented:

| Difference | Acceptable? | Handling |
|-----------|------------|---------|
| Bounds differ | ✅ Yes | Excluded from parity diff |
| Ref ids differ | ✅ Yes | Tree walk order may differ across platforms — compare by (role, label) |
| Role names differ | ❌ No | Normalized roles must match |
| Labels differ | ⚠️ Platform-specific | Allowed only for documented cases (e.g., "Close" vs "X") |
| Extra platform elements | ⚠️ | Filtered out (e.g., Windows title bar buttons vs macOS traffic lights) |
| Element order differs | ✅ Yes | Compare as sorted sets by (role, label), not positional arrays |
| Tree depth differs | ⚠️ | Platforms may inject wrapper groups — compare leaf interactive elements |

---

## 10. Level 7 — Stress & Reliability Tests

**Purpose:** Test behavior under adversarial conditions — rapid commands, crashes, resource exhaustion.

```typescript
// test/stress/rapid-fire.test.ts

describe('Stress: Rapid-Fire Commands', () => {

  test('100 sequential snapshots without error', async () => {
    await ac.grab({ app: 'ACTestApp' });
    for (let i = 0; i < 100; i++) {
      const snap = await ac.snapshot({ interactive: true });
      expect(snap.elements.length).toBeGreaterThan(0);
    }
  });

  test('50 concurrent snapshot requests', async () => {
    await ac.grab({ app: 'ACTestApp' });
    const promises = Array.from({ length: 50 }, () =>
      ac.snapshot({ interactive: true })
    );
    const results = await Promise.all(promises);
    results.forEach(snap => {
      expect(snap.elements.length).toBeGreaterThan(0);
    });
  });

  test('rapid click → snapshot → click cycle', async () => {
    await ac.grab({ app: 'ACTestApp' });
    for (let i = 0; i < 30; i++) {
      const snap = await ac.snapshot({ interactive: true });
      const btn = snap.elements.find(e => e.role === 'button' && e.enabled);
      if (btn) await ac.click(btn.ref);
    }
    // Should not have crashed, leaked memory, or stalled
  });
});

// test/stress/daemon-resilience.test.ts

describe('Stress: Daemon Resilience', () => {

  test('daemon recovers from SIGKILL', async () => {
    const bridge = new Bridge();
    await bridge.send('ping', {});
    const pid = bridge.daemonPid();

    process.kill(pid, 'SIGKILL');
    // Brief wait for OS to reap the process — no ac condition to wait on here
    await sleep(200);

    // Should auto-restart
    const res = await bridge.send('ping', {});
    expect(res.pong).toBe(true);
  });

  test('daemon handles malformed input without crashing', async () => {
    const bridge = new Bridge();
    // Send garbage to socket
    bridge._sendRawToSocket('not valid json\n');

    // Daemon should still be alive
    const res = await bridge.send('ping', {});
    expect(res.pong).toBe(true);
  });

  test('daemon handles unknown method gracefully', async () => {
    const bridge = new Bridge();
    await expect(bridge.send('doesnotexist', {}))
      .rejects.toThrow(/METHOD_NOT_FOUND/);

    // Daemon still alive
    const res = await bridge.send('ping', {});
    expect(res.pong).toBe(true);
  });

  test('daemon recovers from target app quitting', async () => {
    await ac.launch('ACTestApp');
    await ac.grab({ app: 'ACTestApp' });
    await ac.snapshot();

    // Kill target app
    await ac.quit('ACTestApp', { force: true });
    await ac.wait({ app: 'ACTestApp' }, { hidden: true, timeout: 2000 }).catch(() => {});

    // Snapshot should error cleanly, not hang
    await expect(ac.snapshot())
      .rejects.toThrow(/WINDOW_NOT_FOUND|APP_NOT_FOUND/);

    // Daemon itself should still be alive
    const res = await ac.daemon.status();
    expect(res.running).toBe(true);
  });

  test('target app quitting mid-command returns clean error', async () => {
    await ac.launch('ACTestApp');
    await ac.grab({ app: 'ACTestApp' });
    const snap = await ac.snapshot();

    // Kill the target app
    await ac.quit('ACTestApp', { force: true });
    // Brief wait for process to exit — no ac condition available since app is dying
    await sleep(200);

    // Snapshot should return an error, not hang or crash
    await expect(ac.snapshot())
      .rejects.toThrow(/WINDOW_NOT_FOUND|APP_NOT_FOUND/);
  });
});

// test/stress/memory.test.ts

describe('Stress: Memory', () => {

  test('snapshot cache does not grow unbounded', async () => {
    const bridge = new Bridge();
    const initialMemory = await bridge.send('debug_memory', {});

    for (let i = 0; i < 200; i++) {
      await bridge.send('snapshot', { interactive: true });
    }

    const finalMemory = await bridge.send('debug_memory', {});
    // Memory should be within 2× of initial (ring buffer of 10 snapshots)
    expect(finalMemory.rss_mb).toBeLessThan(initialMemory.rss_mb * 2);
  });
});
```

### Error Message Quality Tests

For agent-driven development, error messages are critical. Agents must receive enough context to self-correct.

```typescript
// test/stress/error-quality.test.ts

describe('Error Message Quality', () => {

  test('ELEMENT_NOT_FOUND includes available refs and snapshot hint', async () => {
    await ac.grab({ app: 'ACTestApp' });
    await ac.snapshot(); // establish a snapshot

    try {
      await ac.click('@b999');
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.code).toBe(-32001);
      expect(e.data).toHaveProperty('snapshot_id');
      expect(e.data).toHaveProperty('suggestion');
      expect(e.data.suggestion).toContain('re-snapshot');
    }
  });

  test('WINDOW_NOT_FOUND includes available windows', async () => {
    try {
      await ac.grab('@w999');
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.code).toBe(-32005);
      expect(e.data).toHaveProperty('available_windows');
      expect(Array.isArray(e.data.available_windows)).toBe(true);
    }
  });

  test('INVALID_REF explains the expected format', async () => {
    try {
      await ac.click('notaref');
      fail('Should have thrown');
    } catch (e: any) {
      expect(e.code).toBe(-32006);
      expect(e.message).toContain('@');
      expect(e.data).toHaveProperty('received', 'notaref');
    }
  });
});
```

---

## 11. Level 8 — Agent Workflow Tests

**Purpose:** Test complete multi-step agent scenarios that mirror real use cases. These are the ultimate validation that `ac` works for its intended purpose.

```typescript
// test/e2e/agent-workflows.test.ts

describe('E2E: Agent Workflow — Form Filling', () => {

  test('agent fills out a multi-field form and submits', async () => {
    await ac.launch('ACTestApp');
    await ac.grab({ app: 'ACTestApp' });
    await ac.click({ label: 'Form' }); // navigate to Form tab

    const snap = await ac.snapshot({ interactive: true });

    // Agent reads the form fields
    const nameField = snap.elements.find(e => e.label === 'Full Name');
    const emailField = snap.elements.find(e => e.label === 'Email');
    const countryDropdown = snap.elements.find(e => e.label === 'Country');
    const agreeCheckbox = snap.elements.find(e => e.label === 'I agree');
    const submitBtn = snap.elements.find(e => e.label === 'Submit');

    expect(nameField).toBeDefined();
    expect(emailField).toBeDefined();
    expect(countryDropdown).toBeDefined();
    expect(agreeCheckbox).toBeDefined();
    expect(submitBtn).toBeDefined();

    // Agent fills the form
    await ac.fill(nameField!.ref, 'Agent Smith');
    await ac.fill(emailField!.ref, 'agent@datawizz.ai');
    await ac.select(countryDropdown!.ref, 'United States');
    await ac.check(agreeCheckbox!.ref);
    await ac.click(submitBtn!.ref);

    // Verify submission
    await ac.wait({ text: 'Form submitted successfully' });
    const status = await readTestAppStatus();
    expect(status).toContain('Form submitted');
    expect(status).toContain('Agent Smith');
  });
});

describe('E2E: Agent Workflow — Multi-App Interaction', () => {

  test('agent copies text from one app to another', async () => {
    // Launch both test apps (A and B variants)
    await ac.launch('ACTestApp');
    await ac.launch('ACTestAppB');

    // Read from App A
    await ac.grab({ app: 'ACTestApp' });
    const snap1 = await ac.snapshot({ interactive: true });
    const sourceField = snap1.elements.find(e => e.label === 'Source Text');
    const sourceValue = sourceField?.value;
    expect(sourceValue).toBeTruthy();

    // Copy to clipboard
    await ac.focus(sourceField!.ref);
    await ac.key('cmd+a');
    await ac.key('cmd+c');

    // Switch to App B
    await ac.grab({ app: 'ACTestAppB' });
    const snap2 = await ac.snapshot({ interactive: true });
    const destField = snap2.elements.find(e => e.label === 'Destination');

    // Paste
    await ac.focus(destField!.ref);
    await ac.key('cmd+v');

    // Verify
    const snap3 = await ac.snapshot({ interactive: true });
    const destUpdated = snap3.elements.find(e => e.label === 'Destination');
    expect(destUpdated?.value).toBe(sourceValue);
  });
});

describe('E2E: Agent Workflow — Menu Navigation', () => {

  test('agent uses menu bar to change settings', async () => {
    await ac.launch('ACTestApp');
    await ac.grab({ app: 'ACTestApp' });

    // Open preferences via menu
    await ac.menu('ACTestApp > Settings…');

    // Wait for settings window
    await ac.wait({ window: 'Settings' });

    // Grab the settings window
    const windows = await ac.windows({ app: 'ACTestApp' });
    const settingsWindow = windows.find(w => w.title === 'Settings');
    await ac.grab(settingsWindow!.ref);

    // Change a setting
    const snap = await ac.snapshot({ interactive: true });
    const toggle = snap.elements.find(e => e.label === 'Enable Notifications');
    await ac.check(toggle!.ref);

    // Close settings
    await ac.close(settingsWindow!.ref);

    // Verify setting persisted
    await ac.grab({ app: 'ACTestApp' });
    const status = await readTestAppStatus();
    expect(status).toContain('Notifications: enabled');
  });
});

describe('E2E: Agent Workflow — Error Recovery', () => {

  test('agent recovers from element not found by re-snapshotting', async () => {
    await ac.launch('ACTestApp');
    await ac.grab({ app: 'ACTestApp' });

    // Get initial snapshot
    let snap = await ac.snapshot({ interactive: true });
    const dynButton = snap.elements.find(e => e.label === 'Dynamic Button');
    const dynRef = dynButton!.ref;

    // Click something that changes the UI (removes Dynamic Button)
    await ac.click({ label: 'Toggle Dynamic' });
    await ac.wait({ label: 'Dynamic Button' }, { hidden: true, timeout: 2000 });

    // Old ref should fail
    const clickResult = await ac.click(dynRef).catch(e => e);
    expect(clickResult).toBeInstanceOf(Error);
    expect(clickResult.message).toMatch(/ELEMENT_NOT_FOUND/);

    // Agent re-snapshots and recovers
    snap = await ac.snapshot({ interactive: true });
    const dynButtonGone = snap.elements.find(e => e.label === 'Dynamic Button');
    expect(dynButtonGone).toBeUndefined();

    // Toggle back
    await ac.click({ label: 'Toggle Dynamic' });
    snap = await ac.snapshot({ interactive: true });
    const dynButtonBack = snap.elements.find(e => e.label === 'Dynamic Button');
    expect(dynButtonBack).toBeDefined();
  });
});
```

---

## 12. Test Fixtures — Synthetic Test Apps

### macOS: ACTestApp (SwiftUI)

```
native/macos/TestApp/
├── ACTestApp.xcodeproj
└── ACTestApp/
    ├── App.swift
    ├── ContentView.swift          # Tab container
    ├── Tabs/
    │   ├── ButtonsTab.swift       # Various button types, disabled buttons, right-click target
    │   ├── TextInputTab.swift     # Text fields, text areas, prefilled field, password field
    │   ├── ScrollAreaTab.swift    # Vertical scroll with 100 items, nested scroll, horizontal scroll
    │   ├── ControlsTab.swift     # Checkbox, radio group, slider, dropdown, toggle, stepper
    │   ├── DragDropTab.swift     # Draggable items, drop zones, reorderable list
    │   ├── FormTab.swift         # Multi-field form with validation and submit
    │   ├── AsyncTab.swift        # Elements that appear/disappear on timer, loading spinner
    │   ├── DialogsTab.swift      # Buttons that trigger alerts, sheets, popovers
    │   └── KeyboardTab.swift     # Key event display, modifier tracking, shortcut triggers
    ├── StatusBar.swift            # Bottom bar showing last action (testable via AX)
    └── Info.plist
```

**Key design rules for the test app:**

1. Every interactive element has a unique, stable accessibility label.
2. The `StatusBar` displays the last action in a deterministic format: `"<Action>: <Target>"`.
3. **Side-channel output:** Every action also writes the status to `/tmp/ac-test-status.txt`. This file is the primary verification mechanism for functional tests, avoiding circular dependency on `ac snapshot`.
4. No animations that would cause timing-dependent test failures (or use `UIView.setAnimationsEnabled(false)`).
5. Deterministic layout — no auto-sizing that varies by font rendering or screen size.
6. The app launches to a known state every time (no persistent state).
7. Each tab is self-contained — navigating to a tab resets its state.
8. **Deliberate hierarchy:** Each tab must contain at least one named group/container (e.g., "Toolbar", "Content") wrapping its interactive elements, so hierarchy tests can validate parent-child relationships.
9. **Error message quality:** When `ac` returns errors (element not found, timeout, etc.), the error `data` should include actionable info (available refs, last snapshot ID, suggestion to re-snapshot).

### Windows: ACTestApp (WPF)

```
native/windows/TestApp/
├── ACTestApp.csproj
└── src/
    ├── App.xaml
    ├── MainWindow.xaml            # Tab container
    ├── Tabs/
    │   ├── ButtonsTab.xaml        # Mirror of macOS ButtonsTab
    │   ├── TextInputTab.xaml
    │   ├── ScrollAreaTab.xaml
    │   ├── ControlsTab.xaml
    │   ├── DragDropTab.xaml
    │   ├── FormTab.xaml
    │   ├── AsyncTab.xaml
    │   ├── DialogsTab.xaml
    │   └── KeyboardTab.xaml
    └── StatusBar.xaml             # Same pattern as macOS
```

Every element in the WPF app has `AutomationProperties.AutomationId` and `AutomationProperties.Name` matching the macOS accessibility labels exactly.

### Test App Build in CI

```yaml
- name: Build macOS test app
  if: runner.os == 'macOS'
  run: |
    xcodebuild -project native/macos/TestApp/ACTestApp.xcodeproj \
      -scheme ACTestApp -configuration Release build

- name: Build Windows test app
  if: runner.os == 'Windows'
  run: |
    dotnet build native/windows/TestApp/ACTestApp.csproj -c Release
```

### Helpers for Tests

```typescript
// test/helpers/test-app.ts

import { ac } from '../../src';

const TEST_APP_NAME = 'ACTestApp';

export async function launchTestApp(): Promise<void> {
  await ac.launch(TEST_APP_NAME, { wait: true });
  await ac.grab({ app: TEST_APP_NAME });
  // Wait for the status bar to be ready
  await ac.wait({ text: 'Ready' });
}

export async function killTestApp(): Promise<void> {
  await ac.ungrab();
  await ac.quit(TEST_APP_NAME, { force: true });
}

/**
 * Read test app status via side-channel file.
 * Does NOT use ac — avoids circular dependency on snapshot.
 */
export async function readTestAppStatus(): Promise<string> {
  const STATUS_FILE = '/tmp/ac-test-status.txt';
  // Poll briefly in case the write hasn't flushed yet
  for (let i = 0; i < 10; i++) {
    try {
      return readFileSync(STATUS_FILE, 'utf-8').trim();
    } catch {
      await sleep(50);
    }
  }
  throw new Error('Test app status file not found');
}

/**
 * Read test app status via ac snapshot (used only in dedicated snapshot verification tests).
 */
export async function readTestAppStatusViaAX(): Promise<string> {
  const snap = await ac.snapshot();
  const statusBar = snap.elements.find(
    e => e.label === 'Status Bar' || e.role === 'text' && e.label?.startsWith('Status:')
  );
  return statusBar?.value ?? '';
}

export async function navigateToTab(tabName: string): Promise<void> {
  const snap = await ac.snapshot({ interactive: true });
  const tab = snap.elements.find(e => e.role === 'tab' && e.label === tabName);
  if (!tab) throw new Error(`Tab "${tabName}" not found in snapshot`);
  await ac.click(tab.ref);
  // Wait for tab content to appear rather than arbitrary sleep
  await ac.wait({ text: `${tabName} Tab Ready` }, { timeout: 2000 });
}
```

---

## 13. CI Pipeline

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ─── Fast feedback (any OS) ───
  contract-and-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run test:contract     # Level 0
      - run: npm run test:unit         # Level 1

  swift-unit:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - run: cd native/macos && swift test    # Level 2 (Swift)

  csharp-unit:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '9.0' }
      - run: cd native/windows && dotnet test   # Level 2 (C#)

  # ─── Integration (needs real binary) ───
  integration-macos:
    needs: [contract-and-unit, swift-unit]
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd native/macos && swift build -c release
      - run: npm ci && npm run build
      - run: npm run test:integration    # Level 3

  integration-windows:
    needs: [contract-and-unit, csharp-unit]
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '9.0' }
      - run: cd native/windows && dotnet publish -c Release -r win-x64 --self-contained
      - run: npm ci && npm run build
      - run: npm run test:integration

  # ─── Functional (needs real apps + permissions) ───
  functional-macos:
    needs: integration-macos
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      # Accessibility and Screen Recording permissions are pre-granted on the
      # dedicated CI machine. See docs/ci-setup.md for runner configuration.
      - name: Build binary + test app
        run: |
          cd native/macos && swift build -c release
          xcodebuild -project TestApp/ACTestApp.xcodeproj -scheme ACTestApp build
      - run: npm ci && npm run build
      - run: npm run test:functional     # Level 4
      - run: npm run test:fidelity       # Level 5

  functional-windows:
    needs: integration-windows
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '9.0' }
      - name: Build binary + test app
        run: |
          cd native/windows && dotnet publish -c Release -r win-x64 --self-contained
          dotnet build TestApp/ACTestApp.csproj -c Release
      - run: npm ci && npm run build
      - run: npm run test:functional
      - run: npm run test:fidelity

  # ─── Parity (cross-platform diff) ───
  parity:
    needs: [functional-macos, functional-windows]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: parity-darwin
      - uses: actions/download-artifact@v4
        with:
          name: parity-win32
      - name: Diff parity outputs
        run: |
          for file in parity-darwin/*.json; do
            base=$(basename "$file")
            diff "$file" "parity-win32/$base" || exit 1
          done

  # ─── Stress & E2E (nightly / merge to main) ───
  stress-and-e2e:
    if: github.ref == 'refs/heads/main'
    needs: [functional-macos, functional-windows]
    strategy:
      matrix:
        os: [macos-14, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup (platform-specific)
        run: echo "setup steps..."
      - run: npm run test:stress         # Level 7
      - run: npm run test:e2e            # Level 8
```

### npm scripts

```jsonc
// package.json scripts
{
  "test": "npm run test:contract && npm run test:unit",
  "test:contract": "vitest run test/contract/",
  "test:unit": "vitest run test/unit/",
  "test:integration": "vitest run test/integration/",
  "test:functional": "vitest run test/functional/",
  "test:fidelity": "vitest run test/fidelity/",
  "test:parity": "vitest run test/parity/",
  "test:stress": "vitest run test/stress/ --timeout 60000",
  "test:e2e": "vitest run test/e2e/ --timeout 120000",
  "test:all": "vitest run",
  "test:watch": "vitest watch test/unit/ test/contract/"
}
```

---

## 14. Agent-Driven Development Workflow

### How Tasks Are Structured for Agents

Each feature is a GitHub issue with:

1. **Prerequisite: fixture PR** (already merged — test app has the required UI elements)
2. **A test file** (already committed, all tests fail)
3. **The schema file** (if new RPC methods are needed)
4. **Implementation hints** (which source files to modify)

**Why fixtures are separate:** If the test file references elements that don't exist in the test app, tests fail at *setup* (can't find tab, can't find element) instead of at the *assertion*. The agent can't tell the difference between "my code is wrong" and "the fixture doesn't exist." Splitting fixture creation into a prerequisite step ensures the agent always sees clean assertion failures.

### Example Issue

```markdown
## Implement `ac scroll` command

### Test file
`test/functional/scroll.test.ts` — 8 tests, all currently failing.

### Prerequisites (already merged)
- `schema/methods/scroll.request.json`
- `schema/methods/scroll.response.json`
- `ScrollAreaTab.swift` added to ACTestApp with: vertical list of 100 items, nested scroll area, horizontal scroll

### Implementation checklist
- [ ] `native/macos/Sources/ACCore/Actions/Scroll.swift` — implement scroll via CGEvent
- [ ] Register "scroll" method in `Daemon.swift` dispatcher
- [ ] `src/index.ts` — add `ac.scroll()` SDK method
- [ ] `bin/ac.ts` — add CLI arg parsing for scroll subcommand
- [ ] Run: `npm run test:contract` (must pass)
- [ ] Run: `npm run test:functional -- --grep scroll` (must pass)

### Acceptance
All tests in `test/functional/scroll.test.ts` pass on macOS.
```

### Agent Development Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. Agent receives task (issue link or description) │
│                                                     │
│  2. Agent reads:                                    │
│     - Test file (authoritative spec)                │
│     - Schema files (contract)                       │
│     - Existing code (for patterns)                  │
│                                                     │
│  3. Agent runs failing tests:                       │
│     npm run test:functional -- --grep scroll        │
│     → 0/8 passing                                   │
│                                                     │
│  4. Agent implements, iterating:                    │
│     a. Write code                                   │
│     b. Run tests                                    │
│     c. Read errors                                  │
│     d. Fix code                                     │
│     e. Repeat until green                           │
│                                                     │
│  5. Agent runs broader suite:                       │
│     npm run test:contract                           │
│     npm run test:unit                               │
│     npm run test:integration                        │
│     → Check for regressions                         │
│                                                     │
│  6. Agent commits + pushes                          │
│     CI runs full pipeline                           │
│                                                     │
│  7. Human reviews PR                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Guardrails for Agent Development

| Rule | Enforcement |
|------|-------------|
| No test modifications without human approval | `test/` directory requires CODEOWNERS review |
| Schema changes require contract tests to pass on all platforms | CI gate |
| No skipping tests (`test.skip`) without a linked issue | Lint rule |
| Every new RPC method must have a schema file | CI check: method list vs schema dir listing |
| Functional tests must use test app helpers, never hardcoded PIDs/window IDs | Lint rule |
| Functional tests must use `readTestAppStatus()` (file side-channel), not `ac snapshot` | Code review |
| No `sleep()` in functional tests — use `ac.wait()` for conditions | Lint rule |
| Native code must use the provider protocol (not raw AXUIElement) | Swift/C# lint |
| New schema fields must be optional (not in `"required"`) until all platforms implement | Code review |
| Fixture (test app UI) must be committed before the test file that depends on it | Process |

### AGENTS.md

Include this file in the repo root for AI agent context:

```markdown
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
- `native/macos/Sources/ACCore/Daemon.swift` — RPC method dispatcher
- `native/macos/Sources/ACCore/Protocols/` — provider protocols (mock-friendly)
- `test/helpers/test-app.ts` — helpers for functional tests

## Running tests
- `npm test` — fast (contract + unit, any OS)
- `npm run test:integration` — needs the native binary built
- `npm run test:functional` — needs the binary + test app + accessibility permissions
- `npm run test:functional -- --grep "click"` — run only click-related tests

## Common patterns
- Look at existing commands (e.g., `click`) for the full path: schema → Swift → bridge → SDK → CLI
- Every command returns JSON-RPC. Errors use the codes in `src/errors.ts`.
- Refs look like `@b1`, `@t2`, `@cb1`, etc. See `src/refs.ts` for the prefix table.
- Snapshots are hierarchical trees by default. Use `children` to navigate the tree.
- Functional tests verify via side-channel file (`/tmp/ac-test-status.txt`), NOT via `ac snapshot`.

## Flakiness rules
- Never use `sleep()` in functional tests. Use `ac.wait()` for specific conditions.
- If a test fails intermittently, re-run it once before investigating.
- If it passes on retry, report as flaky in the PR — do NOT modify your implementation.
- If it fails consistently, your code has a bug — fix it.

## Schema evolution
- When adding a new field to an existing response, make it **optional** in the schema.
- Add tests that the new field is present in new responses.
- Do NOT add it to `"required"` until all platforms implement it.
```

---

## 15. Coverage & Quality Gates

### Coverage Targets

| Level | Target | Measurement |
|-------|--------|------------|
| TS unit (L1) | 95% line coverage | `vitest --coverage` |
| Swift unit (L2) | 90% line coverage | `swift test --enable-code-coverage` |
| C# unit (L2) | 90% line coverage | `dotnet test --collect:"XPlat Code Coverage"` |
| Integration (L3) | No target (scenario-based) | Count of passing tests |
| Functional (L4) | Every command has ≥ 2 tests | CI check |
| Schema coverage | Every RPC method has a schema | CI check: method list diff |

### Quality Gates (PR merge requirements)

1. All L0-L3 tests pass on all platforms.
2. All L4-L5 tests pass on the affected platform.
3. No decrease in test count (tests can only be added, not removed, without CODEOWNERS approval).
4. Schema coverage: 100% — every method in the dispatcher has a corresponding schema.
5. No `console.log` or `print()` in production code (only in debug paths gated by `--verbose`).
6. All JSON output validated against schema in at least one test.

---

## 16. Test File Structure

```
test/
├── contract/
│   ├── schema-validation.test.ts        # TS-side schema validation
│   └── examples-valid.test.ts           # All example files validate
│
├── unit/
│   ├── refs.test.ts                     # Ref parsing, validation, prefix mapping
│   ├── bridge.test.ts                   # Message construction, response parsing
│   ├── errors.test.ts                   # Error code mapping, typed errors
│   ├── cli-args.test.ts                 # CLI argument parsing
│   ├── config.test.ts                   # Config resolution (env > file > defaults)
│   └── platform.test.ts                 # Binary resolution per platform
│
├── integration/
│   ├── daemon.test.ts                   # Daemon start, stop, restart, crash recovery
│   ├── one-shot.test.ts                 # Binary exec per command
│   ├── grab.test.ts                     # Grab/ungrab state management
│   └── concurrent.test.ts              # Concurrent command handling
│
├── functional/
│   ├── click.test.ts                   # Click, right-click, double, modifiers, --wait, --human
│   ├── type.test.ts                    # Type, fill, clear, delay, --human, fill --wait
│   ├── scroll.test.ts
│   ├── drag.test.ts
│   ├── keyboard.test.ts
│   ├── select.test.ts
│   ├── menu.test.ts
│   ├── window.test.ts                  # Including raise (formerly focus for windows)
│   ├── wait.test.ts
│   ├── clipboard.test.ts
│   ├── screenshot.test.ts
│   ├── read.test.ts
│   ├── alert.test.ts
│   ├── dialog.test.ts                  # File dialogs, dialog detection, button click
│   ├── find.test.ts                    # Find by text, role, --first
│   ├── batch.test.ts                   # Sequential batch, --bail
│   ├── record.test.ts                  # Start, stop, status, output file
│   ├── changed.test.ts                 # UI change detection
│   ├── daemon.test.ts                  # Daemon start/stop/status/restart (functional)
│   └── snapshot-hierarchy.test.ts      # Tree structure, children, compact, depth
│
├── fidelity/
│   ├── snapshot-golden.test.ts          # Golden file comparisons
│   └── golden/                          # Blessed snapshot outputs
│       ├── buttons-tab.json
│       ├── text-input-tab.json
│       ├── controls-tab.json
│       └── ...
│
├── parity/
│   ├── snapshot-parity.test.ts          # Cross-platform output comparison
│   └── output/                          # Generated per CI run
│       ├── buttons-darwin.json
│       └── buttons-win32.json
│
├── stress/
│   ├── rapid-fire.test.ts              # High-frequency command sequences
│   ├── daemon-resilience.test.ts       # Crash recovery, malformed socket input
│   ├── memory.test.ts                  # Memory leak detection
│   └── error-quality.test.ts           # Error messages contain actionable context
│
├── e2e/
│   ├── form-filling.test.ts            # Complete form workflow
│   ├── multi-app.test.ts               # Cross-app interaction
│   ├── menu-navigation.test.ts         # Menu bar workflow
│   └── error-recovery.test.ts          # Agent recovers from failures
│
└── helpers/
    ├── test-app.ts                      # Launch, kill, read status, navigate tabs
    ├── golden.ts                        # Golden file load/update/compare
    ├── sleep.ts                         # Promisified sleep
    └── process.ts                       # Process existence check, PID helpers
```
