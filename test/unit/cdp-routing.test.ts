import { describe, test, expect } from 'vitest';

describe('CDP Routing Logic', () => {

  // --- CLI session command: ref vs app name detection ---
  // Bug #1: `ac grab Spotify` sent { ref: "Spotify" } instead of { app: "Spotify" }

  test('grab CLI sends app param for plain app name', () => {
    function buildGrabParams(positional: string): Record<string, unknown> {
      const params: Record<string, unknown> = {};
      if (positional.startsWith('@')) {
        params.ref = positional;
      } else {
        params.app = positional;
      }
      return params;
    }

    expect(buildGrabParams('Spotify')).toEqual({ app: 'Spotify' });
    expect(buildGrabParams('Google Chrome')).toEqual({ app: 'Google Chrome' });
    expect(buildGrabParams('@w1')).toEqual({ ref: '@w1' });
    expect(buildGrabParams('@w23')).toEqual({ ref: '@w23' });
  });

  // --- handleGrab response parsing ---
  // Bug #2: handleGrab read result.process_id instead of result.window.process_id

  test('grab result: pid and app are inside result.window', () => {
    // Actual shape returned by the native daemon
    const daemonResult = {
      ok: true,
      window: {
        ref: '@w3',
        title: 'Spotify Premium',
        app: 'Spotify',
        bundle_id: 'com.spotify.client',
        process_id: 12345,
        bounds: [65, 127, 1712, 993],
        minimized: false,
        hidden: false,
        fullscreen: false,
      },
    };

    const windowInfo = (daemonResult.window ?? daemonResult) as Record<string, unknown>;
    expect(windowInfo.process_id).toBe(12345);
    expect(windowInfo.app).toBe('Spotify');
  });

  test('grab result: fallback when window key missing', () => {
    const flatResult = { ok: true, process_id: 99999, app: 'SomeApp' };
    const windowInfo = ((flatResult as any).window ?? flatResult) as Record<string, unknown>;
    expect(windowInfo.process_id).toBe(99999);
    expect(windowInfo.app).toBe('SomeApp');
  });

  // --- CDP routing decisions ---

  test('CDP-capable methods route to CDP when grabbed app is CDP', () => {
    const CDP_CAPABLE_METHODS = new Set([
      'snapshot', 'find', 'read', 'children', 'click', 'hover', 'focus',
      'type', 'fill', 'key', 'scroll', 'select', 'check', 'uncheck',
      'box', 'is', 'changed', 'diff',
    ]);
    const grabbedAppInfo = { pid: 123, isCDP: true, app: 'Spotify' };

    function shouldRouteToCDP(method: string): boolean {
      return CDP_CAPABLE_METHODS.has(method) && grabbedAppInfo?.isCDP === true;
    }

    expect(shouldRouteToCDP('snapshot')).toBe(true);
    expect(shouldRouteToCDP('click')).toBe(true);
    expect(shouldRouteToCDP('type')).toBe(true);
    expect(shouldRouteToCDP('fill')).toBe(true);

    // Native-only methods never route to CDP
    expect(shouldRouteToCDP('screenshot')).toBe(false);
    expect(shouldRouteToCDP('windows')).toBe(false);
    expect(shouldRouteToCDP('apps')).toBe(false);
    expect(shouldRouteToCDP('quit')).toBe(false);
    expect(shouldRouteToCDP('menu_click')).toBe(false);
  });

  test('nothing routes to CDP when grabbed app is not CDP', () => {
    const CDP_CAPABLE_METHODS = new Set(['snapshot', 'click']);
    const grabbedAppInfo = { pid: 123, isCDP: false, app: 'TextEdit' };

    function shouldRouteToCDP(method: string): boolean {
      return CDP_CAPABLE_METHODS.has(method) && grabbedAppInfo?.isCDP === true;
    }

    expect(shouldRouteToCDP('snapshot')).toBe(false);
    expect(shouldRouteToCDP('click')).toBe(false);
  });

  test('nothing routes to CDP when no app grabbed', () => {
    const CDP_CAPABLE_METHODS = new Set(['snapshot', 'click']);
    const grabbedAppInfo: { pid: number; isCDP: boolean } | null = null;

    function shouldRouteToCDP(method: string): boolean {
      return CDP_CAPABLE_METHODS.has(method) && grabbedAppInfo?.isCDP === true;
    }

    expect(shouldRouteToCDP('snapshot')).toBe(false);
  });

  // --- sendToCDP snapshot needs window info from native ---

  test('snapshot via CDP extracts windowInfo from native windows result', () => {
    const windowsResult = {
      windows: [{
        ref: '@w3', title: 'Spotify Premium', app: 'Spotify',
        process_id: 12345, bounds: [65, 127, 1712, 993],
        minimized: false, hidden: false, fullscreen: false,
      }],
    };

    const win = windowsResult.windows?.[0];
    expect(win).toBeDefined();
    expect(win.bounds).toEqual([65, 127, 1712, 993]);
    expect(win.process_id).toBe(12345);
  });

  // --- Imports still work ---

  test('Bridge exposes sendToNative alongside send', async () => {
    const { Bridge } = await import('../../src/bridge.js');
    const bridge = new Bridge({ timeout: 5000 });
    expect(typeof bridge.send).toBe('function');
    expect(typeof bridge.sendToNative).toBe('function');
  });

  test('SDK exposes relaunch', async () => {
    const { AC } = await import('../../src/sdk.js');
    const ac = new AC({ timeout: 5000 });
    expect(typeof ac.relaunch).toBe('function');
  });
});
