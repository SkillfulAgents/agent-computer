import { describe, test, expect } from 'vitest';
import { mapCDPRole, INTERACTIVE_ROLES } from '../../src/cdp/role-map.js';

describe('CDP Role Map', () => {
  test('button maps to button', () => {
    expect(mapCDPRole('button')).toBe('button');
  });

  test('textbox maps to textfield', () => {
    expect(mapCDPRole('textbox')).toBe('textfield');
  });

  test('searchbox maps to textfield', () => {
    expect(mapCDPRole('searchbox')).toBe('textfield');
  });

  test('link maps to link', () => {
    expect(mapCDPRole('link')).toBe('link');
  });

  test('checkbox maps to checkbox', () => {
    expect(mapCDPRole('checkbox')).toBe('checkbox');
  });

  test('radio maps to radio', () => {
    expect(mapCDPRole('radio')).toBe('radio');
  });

  test('slider maps to slider', () => {
    expect(mapCDPRole('slider')).toBe('slider');
  });

  test('combobox maps to dropdown', () => {
    expect(mapCDPRole('combobox')).toBe('dropdown');
  });

  test('listbox maps to dropdown', () => {
    expect(mapCDPRole('listbox')).toBe('dropdown');
  });

  test('img maps to image', () => {
    expect(mapCDPRole('img')).toBe('image');
  });

  test('heading maps to text', () => {
    expect(mapCDPRole('heading')).toBe('text');
  });

  test('StaticText maps to text', () => {
    expect(mapCDPRole('StaticText')).toBe('text');
  });

  test('tab maps to tab', () => {
    expect(mapCDPRole('tab')).toBe('tab');
  });

  test('tablist maps to tabgroup', () => {
    expect(mapCDPRole('tablist')).toBe('tabgroup');
  });

  test('menuitem maps to menuitem', () => {
    expect(mapCDPRole('menuitem')).toBe('menuitem');
  });

  test('table maps to table', () => {
    expect(mapCDPRole('table')).toBe('table');
  });

  test('row maps to row', () => {
    expect(mapCDPRole('row')).toBe('row');
  });

  test('tree maps to treeview', () => {
    expect(mapCDPRole('tree')).toBe('treeview');
  });

  test('progressbar maps to progress', () => {
    expect(mapCDPRole('progressbar')).toBe('progress');
  });

  test('WebArea maps to webarea', () => {
    expect(mapCDPRole('WebArea')).toBe('webarea');
  });

  test('RootWebArea maps to webarea', () => {
    expect(mapCDPRole('RootWebArea')).toBe('webarea');
  });

  test('navigation maps to group', () => {
    expect(mapCDPRole('navigation')).toBe('group');
  });

  test('generic maps to generic', () => {
    expect(mapCDPRole('generic')).toBe('generic');
  });

  test('none maps to generic', () => {
    expect(mapCDPRole('none')).toBe('generic');
  });

  test('unknown role maps to generic', () => {
    expect(mapCDPRole('totally_unknown_role')).toBe('generic');
  });

  test('INTERACTIVE_ROLES includes expected CDP roles', () => {
    expect(INTERACTIVE_ROLES.has('button')).toBe(true);
    expect(INTERACTIVE_ROLES.has('textbox')).toBe(true);
    expect(INTERACTIVE_ROLES.has('searchbox')).toBe(true);
    expect(INTERACTIVE_ROLES.has('link')).toBe(true);
    expect(INTERACTIVE_ROLES.has('checkbox')).toBe(true);
    expect(INTERACTIVE_ROLES.has('radio')).toBe(true);
    expect(INTERACTIVE_ROLES.has('slider')).toBe(true);
    expect(INTERACTIVE_ROLES.has('combobox')).toBe(true);
    expect(INTERACTIVE_ROLES.has('listbox')).toBe(true);
    expect(INTERACTIVE_ROLES.has('tab')).toBe(true);
    expect(INTERACTIVE_ROLES.has('menuitem')).toBe(true);
    expect(INTERACTIVE_ROLES.has('treeitem')).toBe(true);
  });

  test('INTERACTIVE_ROLES excludes non-interactive CDP roles', () => {
    expect(INTERACTIVE_ROLES.has('group')).toBe(false);
    expect(INTERACTIVE_ROLES.has('generic')).toBe(false);
    expect(INTERACTIVE_ROLES.has('img')).toBe(false);
    expect(INTERACTIVE_ROLES.has('heading')).toBe(false);
    expect(INTERACTIVE_ROLES.has('navigation')).toBe(false);
    expect(INTERACTIVE_ROLES.has('RootWebArea')).toBe(false);
  });
});
