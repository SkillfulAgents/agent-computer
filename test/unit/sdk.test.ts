import { describe, test, expect } from 'vitest';
import { AC } from '../../src/sdk.js';

describe('SDK — AC class', () => {
  test('AC constructor creates instance', () => {
    const ac = new AC({ timeout: 5000 });
    expect(ac).toBeDefined();
    expect(ac).toBeInstanceOf(AC);
  });

  test('AC has all expected methods', () => {
    const ac = new AC();
    // Snapshot & observation
    expect(typeof ac.snapshot).toBe('function');
    expect(typeof ac.find).toBe('function');
    expect(typeof ac.read).toBe('function');
    expect(typeof ac.box).toBe('function');
    expect(typeof ac.is).toBe('function');
    expect(typeof ac.children).toBe('function');

    // Actions
    expect(typeof ac.click).toBe('function');
    expect(typeof ac.clickAt).toBe('function');
    expect(typeof ac.hover).toBe('function');
    expect(typeof ac.hoverAt).toBe('function');
    expect(typeof ac.type).toBe('function');
    expect(typeof ac.fill).toBe('function');
    expect(typeof ac.key).toBe('function');
    expect(typeof ac.paste).toBe('function');
    expect(typeof ac.focus).toBe('function');
    expect(typeof ac.check).toBe('function');
    expect(typeof ac.uncheck).toBe('function');
    expect(typeof ac.select).toBe('function');
    expect(typeof ac.set).toBe('function');
    expect(typeof ac.scroll).toBe('function');
    expect(typeof ac.drag).toBe('function');

    // Menu
    expect(typeof ac.menuClick).toBe('function');
    expect(typeof ac.menuList).toBe('function');

    // Apps & windows
    expect(typeof ac.apps).toBe('function');
    expect(typeof ac.launch).toBe('function');
    expect(typeof ac.quit).toBe('function');
    expect(typeof ac.switch).toBe('function');
    expect(typeof ac.windows).toBe('function');
    expect(typeof ac.grab).toBe('function');
    expect(typeof ac.ungrab).toBe('function');

    // Window management
    expect(typeof ac.minimize).toBe('function');
    expect(typeof ac.maximize).toBe('function');
    expect(typeof ac.fullscreen).toBe('function');
    expect(typeof ac.closeWindow).toBe('function');
    expect(typeof ac.raise).toBe('function');
    expect(typeof ac.move).toBe('function');
    expect(typeof ac.resize).toBe('function');
    expect(typeof ac.bounds).toBe('function');

    // Screenshot & displays
    expect(typeof ac.screenshot).toBe('function');
    expect(typeof ac.displays).toBe('function');

    // Clipboard
    expect(typeof ac.clipboardRead).toBe('function');
    expect(typeof ac.clipboardSet).toBe('function');

    // Dialog
    expect(typeof ac.dialog).toBe('function');
    expect(typeof ac.dialogAccept).toBe('function');
    expect(typeof ac.dialogCancel).toBe('function');
    expect(typeof ac.dialogFile).toBe('function');

    // Wait
    expect(typeof ac.wait).toBe('function');
    expect(typeof ac.waitForApp).toBe('function');
    expect(typeof ac.waitForWindow).toBe('function');
    expect(typeof ac.waitForText).toBe('function');

    // Batch & diff
    expect(typeof ac.batch).toBe('function');
    expect(typeof ac.changed).toBe('function');
    expect(typeof ac.diff).toBe('function');

    // Status
    expect(typeof ac.status).toBe('function');
    expect(typeof ac.permissions).toBe('function');
    expect(typeof ac.title).toBe('function');

    // Lifecycle
    expect(typeof ac.disconnect).toBe('function');
    expect(typeof ac.shutdown).toBe('function');
  });
});
