import { describe, test, expect } from 'vitest';
import Ajv from 'ajv';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '../../schema');

function loadJSON(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, relativePath), 'utf-8'));
}

// Load all schemas and configure Ajv
function createValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });

  // Load type schemas
  const refSchema = loadJSON('types/ref.json') as Record<string, unknown>;
  const roleSchema = loadJSON('types/normalized-role.json') as Record<string, unknown>;
  const elementSchema = loadJSON('types/element.json') as Record<string, unknown>;
  const windowInfoSchema = loadJSON('types/window-info.json') as Record<string, unknown>;

  // Register with both full path and basename (for $ref resolution)
  ajv.addSchema(refSchema, 'types/ref.json');
  ajv.addSchema(refSchema, 'ref.json');
  ajv.addSchema(roleSchema, 'types/normalized-role.json');
  ajv.addSchema(roleSchema, 'normalized-role.json');
  ajv.addSchema(elementSchema, 'types/element.json');
  ajv.addSchema(windowInfoSchema, 'types/window-info.json');
  ajv.addSchema(windowInfoSchema, 'window-info.json');

  return ajv;
}

describe('Contract: JSON Schema Validation', () => {
  const ajv = createValidator();

  describe('Ref format', () => {
    const validate = ajv.compile(loadJSON('types/ref.json') as Record<string, unknown>);

    test('accepts valid single-letter refs', () => {
      expect(validate('@b1')).toBe(true);
      expect(validate('@t23')).toBe(true);
      expect(validate('@w1')).toBe(true);
      expect(validate('@e100')).toBe(true);
      expect(validate('@l3')).toBe(true);
      expect(validate('@m4')).toBe(true);
      expect(validate('@c5')).toBe(true);
      expect(validate('@r6')).toBe(true);
      expect(validate('@s7')).toBe(true);
      expect(validate('@d8')).toBe(true);
      expect(validate('@i9')).toBe(true);
      expect(validate('@g10')).toBe(true);
      expect(validate('@x11')).toBe(true);
      expect(validate('@o12')).toBe(true);
      expect(validate('@a13')).toBe(true);
    });

    test('accepts valid two-letter refs', () => {
      expect(validate('@cb1')).toBe(true);
      expect(validate('@sa2')).toBe(true);
      expect(validate('@st3')).toBe(true);
      expect(validate('@sp4')).toBe(true);
      expect(validate('@tl5')).toBe(true);
      expect(validate('@pg6')).toBe(true);
      expect(validate('@tv7')).toBe(true);
      expect(validate('@wb8')).toBe(true);
    });

    test('rejects invalid refs', () => {
      expect(validate('b1')).toBe(false);       // missing @
      expect(validate('@z1')).toBe(false);       // invalid prefix
      expect(validate('@b')).toBe(false);        // missing number
      expect(validate('@b0')).toBe(false);       // zero not allowed
      expect(validate('@@b1')).toBe(false);      // double @
      expect(validate('@b-1')).toBe(false);      // negative
      expect(validate('@zz1')).toBe(false);      // invalid two-letter prefix
      expect(validate('')).toBe(false);          // empty
      expect(validate('@B1')).toBe(false);       // uppercase
    });
  });

  describe('Normalized roles', () => {
    const validate = ajv.compile(loadJSON('types/normalized-role.json') as Record<string, unknown>);

    const EXPECTED_ROLES = [
      'button', 'textfield', 'textarea', 'link', 'checkbox', 'radio',
      'slider', 'dropdown', 'image', 'group', 'window', 'table', 'row',
      'cell', 'tabgroup', 'tab', 'menubar', 'menuitem', 'scrollarea',
      'text', 'toolbar', 'combobox', 'stepper', 'splitgroup', 'timeline',
      'progress', 'treeview', 'webarea', 'generic',
    ];

    test('accepts all expected roles', () => {
      for (const role of EXPECTED_ROLES) {
        expect(validate(role)).toBe(true);
      }
    });

    test('rejects invalid roles', () => {
      expect(validate('foobar')).toBe(false);
      expect(validate('Button')).toBe(false);
      expect(validate('')).toBe(false);
    });
  });

  describe('Error response', () => {
    const validate = ajv.compile(loadJSON('methods/error.response.json') as Record<string, unknown>);

    test('validates correct error response', () => {
      const valid = validate({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32001, message: 'Element not found', data: { ref: '@b99' } },
      });
      expect(valid).toBe(true);
    });

    test('validates error without data', () => {
      const valid = validate({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      });
      expect(valid).toBe(true);
    });
  });

  describe('Element schema', () => {
    // Element schema uses $ref — compile it from the ajv instance that has ref.json and normalized-role.json registered
    const validateElement = ajv.compile(loadJSON('types/element.json') as Record<string, unknown>);

    test('valid element validates', () => {
      expect(validateElement({
        ref: '@b1', role: 'button', label: 'Save', value: null,
        enabled: true, focused: false, bounds: [10, 20, 80, 24],
      })).toBe(true);
    });

    test('element with children validates', () => {
      expect(validateElement({
        ref: '@g1', role: 'group', label: 'Toolbar', value: null,
        enabled: true, focused: false, bounds: [0, 0, 800, 40],
        children: [
          { ref: '@b1', role: 'button', label: 'Save', value: null, enabled: true, focused: false, bounds: [10, 5, 80, 24] },
        ],
      })).toBe(true);
    });

    test('element with two-letter ref validates', () => {
      expect(validateElement({
        ref: '@cb1', role: 'combobox', label: 'Combo', value: null,
        enabled: true, focused: false, bounds: [0, 0, 100, 30],
      })).toBe(true);
    });

    test('element missing required field rejects', () => {
      expect(validateElement({ ref: '@b1', role: 'button' })).toBe(false);
    });

    test('element with invalid role rejects', () => {
      expect(validateElement({
        ref: '@b1', role: 'invalid_role', label: null, value: null,
        enabled: true, focused: false, bounds: [0, 0, 0, 0],
      })).toBe(false);
    });

    test('element with invalid ref rejects', () => {
      expect(validateElement({
        ref: 'notaref', role: 'button', label: null, value: null,
        enabled: true, focused: false, bounds: [0, 0, 0, 0],
      })).toBe(false);
    });
  });

  describe('WindowInfo schema', () => {
    test('valid window info validates', () => {
      const validate = ajv.compile(loadJSON('types/window-info.json') as Record<string, unknown>);
      expect(validate({
        ref: '@w1', title: 'Untitled', app: 'TextEdit', process_id: 123,
        bounds: [0, 0, 800, 600], minimized: false, hidden: false, fullscreen: false,
      })).toBe(true);
    });

    test('window info with optional bundle_id validates', () => {
      const validate = ajv.compile(loadJSON('types/window-info.json') as Record<string, unknown>);
      expect(validate({
        ref: '@w1', title: 'Untitled', app: 'TextEdit', bundle_id: 'com.apple.TextEdit',
        process_id: 123, bounds: [0, 0, 800, 600], minimized: false, hidden: false, fullscreen: false,
      })).toBe(true);
    });
  });

  describe('Example files validate against schemas', () => {
    test('ping response example validates', () => {
      const validate = ajv.compile(loadJSON('methods/ping.response.json') as Record<string, unknown>);
      const example = loadJSON('examples/ping.response.example.json');
      expect(validate(example)).toBe(true);
    });

    test('click response example validates', () => {
      const validate = ajv.compile(loadJSON('methods/click.response.json') as Record<string, unknown>);
      const example = loadJSON('examples/click.response.example.json');
      expect(validate(example)).toBe(true);
    });

    test('error response example validates', () => {
      const validate = ajv.compile(loadJSON('methods/error.response.json') as Record<string, unknown>);
      const example = loadJSON('examples/error.response.example.json');
      expect(validate(example)).toBe(true);
    });
  });
});
