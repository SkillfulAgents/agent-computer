"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPClient = void 0;
const connection_js_1 = require("./connection.js");
const discovery_js_1 = require("./discovery.js");
const ax_tree_js_1 = require("./ax-tree.js");
const interactions_js_1 = require("./interactions.js");
const bounds_js_1 = require("./bounds.js");
const diff_js_1 = require("./diff.js");
class CDPClient {
    port;
    connection;
    axTree = null;
    interactions = null;
    lastRefMap = new Map();
    lastSnapshotId = null;
    lastElements = [];
    contentOffset = { x: 0, y: 0 };
    scaleFactor = 2; // Retina default
    constructor(port) {
        this.port = port;
        this.connection = new connection_js_1.CDPConnection();
    }
    /** Connect to CDP target, enable domains */
    async connect() {
        const target = await (0, discovery_js_1.waitForCDP)(this.port, 10000);
        await this.connection.connect(target.webSocketDebuggerUrl);
        await this.enableDomains();
    }
    /** Reconnect after WebSocket drop */
    async reconnect() {
        try {
            await this.connection.close();
        }
        catch { /* ok */ }
        const target = await (0, discovery_js_1.waitForCDP)(this.port, 10000);
        this.connection = new connection_js_1.CDPConnection();
        await this.connection.connect(target.webSocketDebuggerUrl);
        await this.enableDomains();
    }
    /** Disconnect from CDP */
    async disconnect() {
        await this.connection.close();
        this.axTree = null;
        this.interactions = null;
    }
    async enableDomains() {
        await Promise.all([
            this.connection.send('Accessibility.enable'),
            this.connection.send('DOM.enable'),
            this.connection.send('Page.enable'),
            this.connection.send('Runtime.enable'),
        ]);
        this.axTree = new ax_tree_js_1.CDPAXTree(this.connection);
        this.interactions = new interactions_js_1.CDPInteractions(this.connection);
        // Determine content offset once per connection
        await this.updateContentOffset();
    }
    /** Check if connected */
    isConnected() {
        return this.connection.connected;
    }
    /** Take a snapshot of the accessibility tree */
    async snapshot(options = {}, windowInfo) {
        if (!this.axTree)
            throw new Error('CDPClient not connected');
        const { elements, refMap } = await this.axTree.getTree({
            interactive: options.interactive,
            depth: options.depth,
        });
        // Resolve bounds
        await (0, bounds_js_1.resolveAllBounds)(this.connection, elements, refMap, windowInfo.bounds, this.contentOffset, this.scaleFactor);
        this.lastRefMap = refMap;
        this.lastSnapshotId = `cdp-${Date.now()}`;
        this.lastElements = elements;
        return {
            snapshot_id: this.lastSnapshotId,
            window: windowInfo,
            elements,
            fallback: null,
        };
    }
    /** Click an element by ref */
    async click(ref, options = {}) {
        const nodeRef = this.resolveRef(ref);
        const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
        await this.interactions.click(nodeRef.backendDOMNodeId, bounds, options);
    }
    /** Click at CSS viewport coordinates */
    async clickAt(x, y, options = {}) {
        await this.interactions.clickAt(x, y, options);
    }
    /** Hover over an element */
    async hover(ref) {
        const nodeRef = this.resolveRef(ref);
        const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
        await this.interactions.hover(bounds);
    }
    /** Focus an element */
    async focus(ref) {
        const nodeRef = this.resolveRef(ref);
        await this.interactions.focus(nodeRef.backendDOMNodeId);
    }
    /** Type text */
    async type(text, options = {}) {
        if (options.delay) {
            await this.interactions.typeWithDelay(text, options.delay);
        }
        else {
            await this.interactions.type(text);
        }
    }
    /** Fill an element with text */
    async fill(ref, text) {
        const nodeRef = this.resolveRef(ref);
        await this.interactions.fill(nodeRef.backendDOMNodeId, text);
    }
    /** Press a key combination */
    async key(combo, repeat) {
        await this.interactions.key(combo, repeat);
    }
    /** Scroll in a direction */
    async scroll(direction, options = {}) {
        let atX;
        let atY;
        if (options.on) {
            const nodeRef = this.resolveRef(options.on);
            const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
            atX = bounds[0] + bounds[2] / 2;
            atY = bounds[1] + bounds[3] / 2;
        }
        await this.interactions.scroll(direction, options.amount, atX, atY);
    }
    /** Select a value in a dropdown */
    async select(ref, value) {
        const nodeRef = this.resolveRef(ref);
        await this.interactions.select(nodeRef.backendDOMNodeId, value);
    }
    /** Check a checkbox */
    async check(ref) {
        const nodeRef = this.resolveRef(ref);
        const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
        await this.interactions.check(nodeRef.backendDOMNodeId, bounds);
    }
    /** Uncheck a checkbox */
    async uncheck(ref) {
        const nodeRef = this.resolveRef(ref);
        const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
        await this.interactions.uncheck(nodeRef.backendDOMNodeId, bounds);
    }
    /** Check if UI changed since last snapshot */
    async changed() {
        if (!this.axTree || this.lastElements.length === 0)
            return true;
        const { elements } = await this.axTree.getTree({});
        return (0, diff_js_1.computeChanged)(this.lastElements, elements);
    }
    /** Get diff since last snapshot */
    async diff() {
        if (!this.axTree || this.lastElements.length === 0) {
            return { changed: true, added: [], removed: [], modified: [] };
        }
        const { elements } = await this.axTree.getTree({});
        return (0, diff_js_1.computeDiff)(this.lastElements, elements);
    }
    /** Find elements by text in last snapshot */
    find(text, options = {}) {
        const lowerText = text.toLowerCase();
        let results = this.flattenElements(this.lastElements).filter(el => {
            const matchText = (el.label?.toLowerCase().includes(lowerText)) ||
                (el.value?.toLowerCase().includes(lowerText));
            if (!matchText)
                return false;
            if (options.role && el.role !== options.role)
                return false;
            return true;
        });
        if (options.first && results.length > 0) {
            results = [results[0]];
        }
        return { elements: results };
    }
    /** Read element value from last snapshot */
    read(ref, attr) {
        const el = this.findElementByRef(ref);
        if (!el)
            throw new Error(`Element not found: ${ref}`);
        if (attr === 'label')
            return { ref, value: el.label };
        if (attr === 'role')
            return { ref, value: el.role };
        if (attr === 'enabled')
            return { ref, value: el.enabled };
        if (attr === 'focused')
            return { ref, value: el.focused };
        return { ref, value: el.value };
    }
    /** Get element bounds */
    async box(ref) {
        const el = this.findElementByRef(ref);
        if (!el)
            throw new Error(`Element not found: ${ref}`);
        return { ref, bounds: el.bounds };
    }
    /** Check element state */
    is(state, ref) {
        const el = this.findElementByRef(ref);
        if (!el)
            throw new Error(`Element not found: ${ref}`);
        switch (state) {
            case 'enabled': return { state, value: el.enabled };
            case 'focused': return { state, value: el.focused };
            case 'visible': return { state, value: el.bounds[2] > 0 && el.bounds[3] > 0 };
            default: return { state, value: false };
        }
    }
    /** Get children of an element from last snapshot */
    children(ref) {
        const el = this.findElementByRef(ref);
        if (!el)
            throw new Error(`Element not found: ${ref}`);
        return { ref, children: el.children ?? [] };
    }
    /** Get the underlying connection (for advanced usage) */
    getConnection() {
        return this.connection;
    }
    /** Get the last ref map */
    getLastRefMap() {
        return this.lastRefMap;
    }
    // --- Private helpers ---
    resolveRef(ref) {
        const nodeRef = this.lastRefMap.get(ref);
        if (!nodeRef) {
            throw new Error(`CDP ref not found: ${ref}. Take a snapshot first.`);
        }
        return nodeRef;
    }
    async getCSSBounds(backendDOMNodeId) {
        return (0, bounds_js_1.getBounds)(this.connection, backendDOMNodeId);
    }
    async updateContentOffset() {
        try {
            const result = await this.connection.send('Runtime.evaluate', {
                expression: 'JSON.stringify({ x: window.screenX, y: window.screenY })',
                returnByValue: true,
            });
            const parsed = JSON.parse(result.result.value);
            this.contentOffset = { x: parsed.x ?? 0, y: parsed.y ?? 0 };
        }
        catch {
            this.contentOffset = { x: 0, y: 0 };
        }
    }
    flattenElements(elements) {
        const result = [];
        const walk = (els) => {
            for (const el of els) {
                result.push(el);
                if (el.children)
                    walk(el.children);
            }
        };
        walk(elements);
        return result;
    }
    findElementByRef(ref) {
        return this.flattenElements(this.lastElements).find(el => el.ref === ref);
    }
}
exports.CDPClient = CDPClient;
