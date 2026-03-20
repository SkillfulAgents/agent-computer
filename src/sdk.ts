// High-level SDK wrapping Bridge with typed methods

import { Bridge, type BridgeOptions } from './bridge.js';
import type {
  Element,
  WindowInfo,
  DisplayInfo,
  StatusInfo,
  PermissionsInfo,
} from './types.js';

export interface SnapshotOptions {
  app?: string;
  interactive?: boolean;
  compact?: boolean;
  depth?: number;
  subtree?: string;
}

export interface SnapshotResult {
  snapshot_id: string;
  elements: Element[];
  window?: WindowInfo;
}

export interface ClickOptions {
  right?: boolean;
  double?: boolean;
  count?: number;
  modifiers?: string[];
}

export interface TypeOptions {
  delay?: number;
}

export interface ScrollOptions {
  amount?: number;
  on?: string;
  pixels?: number;
  smooth?: boolean;
}

export interface DragOptions {
  duration?: number;
  steps?: number;
}

export interface ScreenshotOptions {
  ref?: string;
  screen?: boolean;
  format?: 'png' | 'jpg';
  quality?: number;
  path?: string;
}

export interface ScreenshotInfo {
  ok: boolean;
  path: string;
  width?: number;
  height?: number;
}

export interface FindOptions {
  role?: string;
  first?: boolean;
  app?: string;
}

export interface WaitOptions {
  timeout?: number;
}

export interface BatchCommand {
  method: string;
  params?: Record<string, unknown>;
}

export interface DialogDetection {
  ok: boolean;
  found: boolean;
  dialog?: {
    type: string;
    title?: string;
    message?: string;
    buttons?: Array<{ title: string }>;
  };
}

export interface DiffResult {
  ok: boolean;
  changed: boolean;
  added?: Array<Record<string, unknown>>;
  removed?: Array<Record<string, unknown>>;
}

/**
 * High-level AC SDK for programmatic macOS desktop automation.
 *
 * @example
 * ```ts
 * import { AC } from '@datawizz/ac';
 *
 * const ac = new AC();
 * await ac.launch('TextEdit');
 * const snap = await ac.snapshot({ interactive: true });
 * const textarea = snap.elements.find(e => e.role === 'textarea');
 * if (textarea) {
 *   await ac.fill(textarea.ref, 'Hello from AC!');
 * }
 * await ac.quit('TextEdit');
 * await ac.disconnect();
 * ```
 */
export class AC {
  private bridge: Bridge;

  constructor(options: BridgeOptions = {}) {
    this.bridge = new Bridge(options);
  }

  // MARK: - Snapshot & Observation

  /** Take a snapshot of the accessibility tree */
  async snapshot(options: SnapshotOptions = {}): Promise<SnapshotResult> {
    return await this.bridge.send('snapshot', { ...options }) as SnapshotResult;
  }

  /** Find elements by text and/or role */
  async find(text: string, options: FindOptions = {}): Promise<{ elements: Element[] }> {
    return await this.bridge.send('find', { text, ...options }) as { elements: Element[] };
  }

  /** Read an element's value */
  async read(ref: string, attr?: string): Promise<{ ref: string; value: unknown }> {
    return await this.bridge.send('read', { ref, ...(attr ? { attr } : {}) }) as { ref: string; value: unknown };
  }

  /** Get element bounds */
  async box(ref: string): Promise<{ ref: string; bounds: [number, number, number, number] }> {
    return await this.bridge.send('box', { ref }) as { ref: string; bounds: [number, number, number, number] };
  }

  /** Check element state (visible, enabled, focused, checked) */
  async is(state: string, ref: string): Promise<{ state: string; value: boolean }> {
    return await this.bridge.send('is', { state, ref }) as { state: string; value: boolean };
  }

  /** Get children of an element */
  async children(ref: string): Promise<{ ref: string; children: Element[] }> {
    return await this.bridge.send('children', { ref }) as { ref: string; children: Element[] };
  }

  // MARK: - Actions

  /** Click an element by ref */
  async click(ref: string, options: ClickOptions = {}): Promise<void> {
    await this.bridge.send('click', { ref, ...options });
  }

  /** Click at screen coordinates */
  async clickAt(x: number, y: number, options: ClickOptions = {}): Promise<void> {
    await this.bridge.send('click', { x, y, ...options });
  }

  /** Hover over an element */
  async hover(ref: string): Promise<void> {
    await this.bridge.send('hover', { ref });
  }

  /** Hover at coordinates */
  async hoverAt(x: number, y: number): Promise<void> {
    await this.bridge.send('hover', { x, y });
  }

  /** Type text into the frontmost app */
  async type(text: string, options: TypeOptions = {}): Promise<void> {
    await this.bridge.send('type', { text, ...options });
  }

  /** Fill an element with text (focus, clear, type) */
  async fill(ref: string, text: string): Promise<void> {
    await this.bridge.send('fill', { ref, text });
  }

  /** Press a key combination */
  async key(combo: string, repeat?: number): Promise<void> {
    await this.bridge.send('key', { combo, ...(repeat ? { repeat } : {}) });
  }

  /** Paste text via clipboard */
  async paste(text: string): Promise<void> {
    await this.bridge.send('paste', { text });
  }

  /** Focus an element */
  async focus(ref: string): Promise<void> {
    await this.bridge.send('focus', { ref });
  }

  /** Check a checkbox */
  async check(ref: string): Promise<void> {
    await this.bridge.send('check', { ref });
  }

  /** Uncheck a checkbox */
  async uncheck(ref: string): Promise<void> {
    await this.bridge.send('uncheck', { ref });
  }

  /** Select a value in a dropdown */
  async select(ref: string, value: string): Promise<void> {
    await this.bridge.send('select', { ref, value });
  }

  /** Set a value on an element */
  async set(ref: string, value: string): Promise<void> {
    await this.bridge.send('set', { ref, value });
  }

  /** Scroll in a direction */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', options: ScrollOptions = {}): Promise<void> {
    await this.bridge.send('scroll', { direction, ...options });
  }

  /** Drag from one element/position to another */
  async drag(
    from: string | { x: number; y: number },
    to: string | { x: number; y: number },
    options: DragOptions = {}
  ): Promise<void> {
    const params: Record<string, unknown> = { ...options };
    if (typeof from === 'string') params.from_ref = from;
    else { params.from_x = from.x; params.from_y = from.y; }
    if (typeof to === 'string') params.to_ref = to;
    else { params.to_x = to.x; params.to_y = to.y; }
    await this.bridge.send('drag', params);
  }

  // MARK: - Menu

  /** Click a menu item by path (e.g. "File > Save") */
  async menuClick(path: string, app?: string): Promise<void> {
    await this.bridge.send('menu_click', { path, ...(app ? { app } : {}) });
  }

  /** List menu items */
  async menuList(menuName?: string, options: { all?: boolean; app?: string } = {}): Promise<{ items: Array<{ title: string }> }> {
    return await this.bridge.send('menu_list', { ...(menuName ? { menu: menuName } : {}), ...options }) as { items: Array<{ title: string }> };
  }

  // MARK: - Apps & Windows

  /** List running applications */
  async apps(): Promise<{ apps: Array<Record<string, unknown>> }> {
    return await this.bridge.send('apps') as { apps: Array<Record<string, unknown>> };
  }

  /** Launch an application */
  async launch(name: string, options: { wait?: boolean; background?: boolean } = {}): Promise<void> {
    await this.bridge.send('launch', { name, ...options });
  }

  /** Quit an application */
  async quit(name: string, options: { force?: boolean } = {}): Promise<void> {
    await this.bridge.send('quit', { name, ...options });
  }

  /** Relaunch an application with CDP support (quit + launch with --remote-debugging-port) */
  async relaunch(name: string, options: { wait?: boolean } = {}): Promise<void> {
    await this.bridge.send('relaunch', { name, ...options });
  }

  /** Switch to (activate) an application */
  async switch(name: string): Promise<void> {
    await this.bridge.send('switch', { name });
  }

  /** List windows */
  async windows(app?: string): Promise<{ windows: WindowInfo[] }> {
    return await this.bridge.send('windows', app ? { app } : {}) as { windows: WindowInfo[] };
  }

  /** Grab (lock onto) a window for subsequent commands */
  async grab(refOrApp: string): Promise<void> {
    if (refOrApp.startsWith('@')) {
      await this.bridge.send('grab', { ref: refOrApp });
    } else {
      await this.bridge.send('grab', { app: refOrApp });
    }
  }

  /** Release the grabbed window */
  async ungrab(): Promise<void> {
    await this.bridge.send('ungrab');
  }

  // MARK: - Window Management

  async minimize(ref?: string): Promise<void> {
    await this.bridge.send('minimize', ref ? { ref } : {});
  }

  async maximize(ref?: string): Promise<void> {
    await this.bridge.send('maximize', ref ? { ref } : {});
  }

  async fullscreen(ref?: string): Promise<void> {
    await this.bridge.send('fullscreen', ref ? { ref } : {});
  }

  async closeWindow(ref?: string): Promise<void> {
    await this.bridge.send('close', ref ? { ref } : {});
  }

  async raise(ref?: string): Promise<void> {
    await this.bridge.send('raise', ref ? { ref } : {});
  }

  async move(x: number, y: number, ref?: string): Promise<void> {
    await this.bridge.send('move', { x, y, ...(ref ? { ref } : {}) });
  }

  async resize(width: number, height: number, ref?: string): Promise<void> {
    await this.bridge.send('resize', { width, height, ...(ref ? { ref } : {}) });
  }

  async bounds(preset: string, ref?: string): Promise<void> {
    await this.bridge.send('bounds', { preset, ...(ref ? { ref } : {}) });
  }

  // MARK: - Screenshot & Displays

  /** Take a screenshot */
  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotInfo> {
    return await this.bridge.send('screenshot', { ...options }) as ScreenshotInfo;
  }

  /** List displays */
  async displays(): Promise<{ displays: DisplayInfo[] }> {
    return await this.bridge.send('displays') as { displays: DisplayInfo[] };
  }

  // MARK: - Clipboard

  /** Read clipboard contents */
  async clipboardRead(): Promise<{ text: string }> {
    return await this.bridge.send('clipboard_read') as { text: string };
  }

  /** Set clipboard contents */
  async clipboardSet(text: string): Promise<void> {
    await this.bridge.send('clipboard_set', { text });
  }

  // MARK: - Dialog

  /** Detect if a dialog/alert is visible */
  async dialog(app?: string): Promise<DialogDetection> {
    return await this.bridge.send('dialog', app ? { app } : {}) as DialogDetection;
  }

  /** Accept (click OK/Save) the current dialog */
  async dialogAccept(app?: string): Promise<void> {
    await this.bridge.send('dialog_accept', app ? { app } : {});
  }

  /** Cancel/dismiss the current dialog */
  async dialogCancel(app?: string): Promise<void> {
    await this.bridge.send('dialog_cancel', app ? { app } : {});
  }

  /** Set the filename in a file dialog */
  async dialogFile(path: string, app?: string): Promise<void> {
    await this.bridge.send('dialog_file', { path, ...(app ? { app } : {}) });
  }

  // MARK: - Wait

  /** Wait for a fixed duration */
  async wait(ms: number): Promise<void> {
    await this.bridge.send('wait', { ms });
  }

  /** Wait for an app to launch */
  async waitForApp(name: string, options: WaitOptions = {}): Promise<void> {
    await this.bridge.send('wait', { app: name, ...options });
  }

  /** Wait for a window with a given title */
  async waitForWindow(title: string, options: WaitOptions = {}): Promise<void> {
    await this.bridge.send('wait', { window: title, ...options });
  }

  /** Wait for text to appear on screen */
  async waitForText(text: string, options: WaitOptions & { gone?: boolean } = {}): Promise<void> {
    await this.bridge.send('wait', { text, ...options });
  }

  // MARK: - Batch & Diff

  /** Execute a batch of commands sequentially */
  async batch(commands: Array<[string, ...unknown[]]>, stopOnError = true): Promise<Record<string, unknown>> {
    return await this.bridge.send('batch', { commands, stop_on_error: stopOnError }) as Record<string, unknown>;
  }

  /** Check if the UI has changed since last snapshot */
  async changed(app?: string): Promise<{ ok: boolean; changed: boolean }> {
    return await this.bridge.send('changed', app ? { app } : {}) as { ok: boolean; changed: boolean };
  }

  /** Get a diff of what changed since last snapshot */
  async diff(app?: string): Promise<DiffResult> {
    return await this.bridge.send('diff', app ? { app } : {}) as DiffResult;
  }

  // MARK: - Status

  /** Get daemon status */
  async status(): Promise<StatusInfo> {
    return await this.bridge.send('status') as StatusInfo;
  }

  /** Check permissions */
  async permissions(): Promise<PermissionsInfo> {
    return await this.bridge.send('permissions') as PermissionsInfo;
  }

  /** Get window title */
  async title(): Promise<{ title: string }> {
    return await this.bridge.send('title') as { title: string };
  }

  // MARK: - Lifecycle

  /** Disconnect from the daemon */
  async disconnect(): Promise<void> {
    await this.bridge.disconnect();
  }

  /** Shut down the daemon */
  async shutdown(): Promise<void> {
    await this.bridge.shutdown();
  }
}
