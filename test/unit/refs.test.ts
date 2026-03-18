import { describe, test, expect } from 'vitest';
import { parseRef, isValidRef, refToRole, REF_PREFIXES, roleToPrefix } from '../../src/refs.js';

describe('Ref Parsing', () => {
  test.each([
    ['@b1', { prefix: 'b', role: 'button', id: 1 }],
    ['@t23', { prefix: 't', role: 'textfield', id: 23 }],
    ['@l3', { prefix: 'l', role: 'link', id: 3 }],
    ['@m4', { prefix: 'm', role: 'menuitem', id: 4 }],
    ['@c5', { prefix: 'c', role: 'checkbox', id: 5 }],
    ['@r6', { prefix: 'r', role: 'radio', id: 6 }],
    ['@s7', { prefix: 's', role: 'slider', id: 7 }],
    ['@d8', { prefix: 'd', role: 'dropdown', id: 8 }],
    ['@i9', { prefix: 'i', role: 'image', id: 9 }],
    ['@g10', { prefix: 'g', role: 'group', id: 10 }],
    ['@w1', { prefix: 'w', role: 'window', id: 1 }],
    ['@x11', { prefix: 'x', role: 'table', id: 11 }],
    ['@o12', { prefix: 'o', role: 'row', id: 12 }],
    ['@a13', { prefix: 'a', role: 'tab', id: 13 }],
    ['@e100', { prefix: 'e', role: 'generic', id: 100 }],
  ] as const)('parseRef(%s) → prefix=%s, role=%s, id=%d', (input, expected) => {
    expect(parseRef(input)).toEqual(expected);
  });

  test.each([
    ['@cb1', { prefix: 'cb', role: 'combobox', id: 1 }],
    ['@sa2', { prefix: 'sa', role: 'scrollarea', id: 2 }],
    ['@st3', { prefix: 'st', role: 'stepper', id: 3 }],
    ['@sp4', { prefix: 'sp', role: 'splitgroup', id: 4 }],
    ['@tl5', { prefix: 'tl', role: 'timeline', id: 5 }],
    ['@pg6', { prefix: 'pg', role: 'progress', id: 6 }],
    ['@tv7', { prefix: 'tv', role: 'treeview', id: 7 }],
    ['@wb8', { prefix: 'wb', role: 'webarea', id: 8 }],
  ] as const)('parseRef(%s) two-letter → prefix=%s, role=%s, id=%d', (input, expected) => {
    expect(parseRef(input)).toEqual(expected);
  });

  test.each([
    'b1',      // missing @
    '@@b1',    // double @
    '@z1',     // invalid single-letter prefix
    '@b',      // missing number
    '@b0',     // zero not allowed
    '@b-1',    // negative
    '',        // empty
    '@B1',     // uppercase
    '@ b1',    // space
    '@zz1',    // invalid two-letter prefix
  ])('parseRef(%s) throws', (input) => {
    expect(() => parseRef(input)).toThrow();
  });
});

describe('isValidRef', () => {
  test('returns true for valid refs', () => {
    expect(isValidRef('@b1')).toBe(true);
    expect(isValidRef('@cb1')).toBe(true);
    expect(isValidRef('@t99')).toBe(true);
  });

  test('returns false for invalid refs', () => {
    expect(isValidRef('b1')).toBe(false);
    expect(isValidRef('@z1')).toBe(false);
    expect(isValidRef('')).toBe(false);
  });
});

describe('refToRole', () => {
  test('every prefix maps to a role', () => {
    for (const [prefix, role] of Object.entries(REF_PREFIXES)) {
      expect(refToRole(prefix)).toBe(role);
    }
  });

  test('unknown prefix returns undefined', () => {
    expect(refToRole('z')).toBeUndefined();
    expect(refToRole('zz')).toBeUndefined();
  });
});

describe('roleToPrefix', () => {
  test('button → b', () => expect(roleToPrefix('button')).toBe('b'));
  test('combobox → cb', () => expect(roleToPrefix('combobox')).toBe('cb'));
  test('scrollarea → sa', () => expect(roleToPrefix('scrollarea')).toBe('sa'));
  test('unknown role → e (generic)', () => expect(roleToPrefix('nonexistent')).toBe('e'));
});
