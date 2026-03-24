"use strict";
// High-level SDK wrapping Bridge with typed methods
Object.defineProperty(exports, "__esModule", { value: true });
exports.AC = void 0;
const bridge_js_1 = require("./bridge.js");
/**
 * High-level AC SDK for programmatic macOS desktop automation.
 *
 * @example
 * ```ts
 * import { AC } from '@skillful-agents/ac';
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
class AC {
    bridge;
    constructor(options = {}) {
        this.bridge = new bridge_js_1.Bridge(options);
    }
    // MARK: - Snapshot & Observation
    /** Take a snapshot of the accessibility tree */
    async snapshot(options = {}) {
        return await this.bridge.send('snapshot', { ...options });
    }
    /** Find elements by text and/or role */
    async find(text, options = {}) {
        return await this.bridge.send('find', { text, ...options });
    }
    /** Read an element's value */
    async read(ref, attr) {
        return await this.bridge.send('read', { ref, ...(attr ? { attr } : {}) });
    }
    /** Get element bounds */
    async box(ref) {
        return await this.bridge.send('box', { ref });
    }
    /** Check element state (visible, enabled, focused, checked) */
    async is(state, ref) {
        return await this.bridge.send('is', { state, ref });
    }
    /** Get children of an element */
    async children(ref) {
        return await this.bridge.send('children', { ref });
    }
    // MARK: - Actions
    /** Click an element by ref */
    async click(ref, options = {}) {
        await this.bridge.send('click', { ref, ...options });
    }
    /** Click at screen coordinates */
    async clickAt(x, y, options = {}) {
        await this.bridge.send('click', { x, y, ...options });
    }
    /** Hover over an element */
    async hover(ref) {
        await this.bridge.send('hover', { ref });
    }
    /** Hover at coordinates */
    async hoverAt(x, y) {
        await this.bridge.send('hover', { x, y });
    }
    /** Type text into the frontmost app */
    async type(text, options = {}) {
        await this.bridge.send('type', { text, ...options });
    }
    /** Fill an element with text (focus, clear, type) */
    async fill(ref, text) {
        await this.bridge.send('fill', { ref, text });
    }
    /** Press a key combination */
    async key(combo, repeat) {
        await this.bridge.send('key', { combo, ...(repeat ? { repeat } : {}) });
    }
    /** Paste text via clipboard */
    async paste(text) {
        await this.bridge.send('paste', { text });
    }
    /** Focus an element */
    async focus(ref) {
        await this.bridge.send('focus', { ref });
    }
    /** Check a checkbox */
    async check(ref) {
        await this.bridge.send('check', { ref });
    }
    /** Uncheck a checkbox */
    async uncheck(ref) {
        await this.bridge.send('uncheck', { ref });
    }
    /** Select a value in a dropdown */
    async select(ref, value) {
        await this.bridge.send('select', { ref, value });
    }
    /** Set a value on an element */
    async set(ref, value) {
        await this.bridge.send('set', { ref, value });
    }
    /** Scroll in a direction */
    async scroll(direction, options = {}) {
        await this.bridge.send('scroll', { direction, ...options });
    }
    /** Drag from one element/position to another */
    async drag(from, to, options = {}) {
        const params = { ...options };
        if (typeof from === 'string')
            params.from_ref = from;
        else {
            params.from_x = from.x;
            params.from_y = from.y;
        }
        if (typeof to === 'string')
            params.to_ref = to;
        else {
            params.to_x = to.x;
            params.to_y = to.y;
        }
        await this.bridge.send('drag', params);
    }
    // MARK: - Menu
    /** Click a menu item by path (e.g. "File > Save") */
    async menuClick(path, app) {
        await this.bridge.send('menu_click', { path, ...(app ? { app } : {}) });
    }
    /** List menu items */
    async menuList(menuName, options = {}) {
        return await this.bridge.send('menu_list', { ...(menuName ? { menu: menuName } : {}), ...options });
    }
    // MARK: - Apps & Windows
    /** List running applications */
    async apps() {
        return await this.bridge.send('apps');
    }
    /** Launch an application */
    async launch(name, options = {}) {
        await this.bridge.send('launch', { name, ...options });
    }
    /** Quit an application */
    async quit(name, options = {}) {
        await this.bridge.send('quit', { name, ...options });
    }
    /** Relaunch an application with CDP support (quit + launch with --remote-debugging-port) */
    async relaunch(name, options = {}) {
        await this.bridge.send('relaunch', { name, ...options });
    }
    /** Switch to (activate) an application */
    async switch(name) {
        await this.bridge.send('switch', { name });
    }
    /** List windows */
    async windows(app) {
        return await this.bridge.send('windows', app ? { app } : {});
    }
    /** Grab (lock onto) a window for subsequent commands */
    async grab(refOrApp) {
        if (refOrApp.startsWith('@')) {
            await this.bridge.send('grab', { ref: refOrApp });
        }
        else {
            await this.bridge.send('grab', { app: refOrApp });
        }
    }
    /** Release the grabbed window */
    async ungrab() {
        await this.bridge.send('ungrab');
    }
    // MARK: - Window Management
    async minimize(ref) {
        await this.bridge.send('minimize', ref ? { ref } : {});
    }
    async maximize(ref) {
        await this.bridge.send('maximize', ref ? { ref } : {});
    }
    async fullscreen(ref) {
        await this.bridge.send('fullscreen', ref ? { ref } : {});
    }
    async closeWindow(ref) {
        await this.bridge.send('close', ref ? { ref } : {});
    }
    async raise(ref) {
        await this.bridge.send('raise', ref ? { ref } : {});
    }
    async move(x, y, ref) {
        await this.bridge.send('move', { x, y, ...(ref ? { ref } : {}) });
    }
    async resize(width, height, ref) {
        await this.bridge.send('resize', { width, height, ...(ref ? { ref } : {}) });
    }
    async bounds(preset, ref) {
        await this.bridge.send('bounds', { preset, ...(ref ? { ref } : {}) });
    }
    // MARK: - Screenshot & Displays
    /** Take a screenshot */
    async screenshot(options = {}) {
        return await this.bridge.send('screenshot', { ...options });
    }
    /** List displays */
    async displays() {
        return await this.bridge.send('displays');
    }
    // MARK: - Clipboard
    /** Read clipboard contents */
    async clipboardRead() {
        return await this.bridge.send('clipboard_read');
    }
    /** Set clipboard contents */
    async clipboardSet(text) {
        await this.bridge.send('clipboard_set', { text });
    }
    // MARK: - Dialog
    /** Detect if a dialog/alert is visible */
    async dialog(app) {
        return await this.bridge.send('dialog', app ? { app } : {});
    }
    /** Accept (click OK/Save) the current dialog */
    async dialogAccept(app) {
        await this.bridge.send('dialog_accept', app ? { app } : {});
    }
    /** Cancel/dismiss the current dialog */
    async dialogCancel(app) {
        await this.bridge.send('dialog_cancel', app ? { app } : {});
    }
    /** Set the filename in a file dialog */
    async dialogFile(path, app) {
        await this.bridge.send('dialog_file', { path, ...(app ? { app } : {}) });
    }
    // MARK: - Wait
    /** Wait for a fixed duration */
    async wait(ms) {
        await this.bridge.send('wait', { ms });
    }
    /** Wait for an app to launch */
    async waitForApp(name, options = {}) {
        await this.bridge.send('wait', { app: name, ...options });
    }
    /** Wait for a window with a given title */
    async waitForWindow(title, options = {}) {
        await this.bridge.send('wait', { window: title, ...options });
    }
    /** Wait for text to appear on screen */
    async waitForText(text, options = {}) {
        await this.bridge.send('wait', { text, ...options });
    }
    // MARK: - Batch & Diff
    /** Execute a batch of commands sequentially */
    async batch(commands, stopOnError = true) {
        return await this.bridge.send('batch', { commands, stop_on_error: stopOnError });
    }
    /** Check if the UI has changed since last snapshot */
    async changed(app) {
        return await this.bridge.send('changed', app ? { app } : {});
    }
    /** Get a diff of what changed since last snapshot */
    async diff(app) {
        return await this.bridge.send('diff', app ? { app } : {});
    }
    // MARK: - Status
    /** Get daemon status */
    async status() {
        return await this.bridge.send('status');
    }
    /** Check permissions */
    async permissions() {
        return await this.bridge.send('permissions');
    }
    /** Get window title */
    async title() {
        return await this.bridge.send('title');
    }
    // MARK: - Lifecycle
    /** Disconnect from the daemon */
    async disconnect() {
        await this.bridge.disconnect();
    }
    /** Shut down the daemon */
    async shutdown() {
        await this.bridge.shutdown();
    }
}
exports.AC = AC;
