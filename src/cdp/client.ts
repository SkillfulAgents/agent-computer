import { CDPConnection } from './connection.js';
import { findPageTarget, waitForCDP } from './discovery.js';
import { CDPAXTree } from './ax-tree.js';
import { CDPInteractions } from './interactions.js';
import { getBounds, toScreenCoords, resolveAllBounds } from './bounds.js';
import { computeChanged, computeDiff } from './diff.js';
import type { CDPNodeRef } from './types.js';
import type { Element, WindowInfo } from '../types.js';

export interface CDPSnapshotOptions {
  interactive?: boolean;
  depth?: number;
}

export interface CDPSnapshotResult {
  snapshot_id: string;
  window: WindowInfo;
  elements: Element[];
  fallback: null;
}

export class CDPClient {
  private connection: CDPConnection;
  private axTree: CDPAXTree | null = null;
  private interactions: CDPInteractions | null = null;

  private lastRefMap = new Map<string, CDPNodeRef>();
  private lastSnapshotId: string | null = null;
  private lastElements: Element[] = [];

  private contentOffset = { x: 0, y: 0 };
  private scaleFactor = 2; // Retina default

  constructor(private port: number) {
    this.connection = new CDPConnection();
  }

  /** Connect to CDP target, enable domains */
  async connect(): Promise<void> {
    const target = await waitForCDP(this.port, 10000);
    await this.connection.connect(target.webSocketDebuggerUrl);
    await this.enableDomains();
  }

  /** Reconnect after WebSocket drop */
  async reconnect(): Promise<void> {
    try { await this.connection.close(); } catch { /* ok */ }
    const target = await waitForCDP(this.port, 10000);
    this.connection = new CDPConnection();
    await this.connection.connect(target.webSocketDebuggerUrl);
    await this.enableDomains();
  }

  /** Disconnect from CDP */
  async disconnect(): Promise<void> {
    await this.connection.close();
    this.axTree = null;
    this.interactions = null;
  }

  private async enableDomains(): Promise<void> {
    await Promise.all([
      this.connection.send('Accessibility.enable'),
      this.connection.send('DOM.enable'),
      this.connection.send('Page.enable'),
      this.connection.send('Runtime.enable'),
    ]);

    this.axTree = new CDPAXTree(this.connection);
    this.interactions = new CDPInteractions(this.connection);

    // Determine content offset once per connection
    await this.updateContentOffset();
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connection.connected;
  }

  /** Take a snapshot of the accessibility tree */
  async snapshot(options: CDPSnapshotOptions = {}, windowInfo: WindowInfo): Promise<CDPSnapshotResult> {
    if (!this.axTree) throw new Error('CDPClient not connected');

    const { elements, refMap } = await this.axTree.getTree({
      interactive: options.interactive,
      depth: options.depth,
    });

    // Resolve bounds
    await resolveAllBounds(
      this.connection,
      elements,
      refMap,
      windowInfo.bounds,
      this.contentOffset,
      this.scaleFactor
    );

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
  async click(ref: string, options: { right?: boolean; double?: boolean; count?: number; modifiers?: string[] } = {}): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
    await this.interactions!.click(nodeRef.backendDOMNodeId, bounds, options);
  }

  /** Click at CSS viewport coordinates */
  async clickAt(x: number, y: number, options: { right?: boolean; double?: boolean; count?: number; modifiers?: string[] } = {}): Promise<void> {
    await this.interactions!.clickAt(x, y, options);
  }

  /** Hover over an element */
  async hover(ref: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
    await this.interactions!.hover(bounds);
  }

  /** Focus an element */
  async focus(ref: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    await this.interactions!.focus(nodeRef.backendDOMNodeId);
  }

  /** Type text */
  async type(text: string, options: { delay?: number } = {}): Promise<void> {
    if (options.delay) {
      await this.interactions!.typeWithDelay(text, options.delay);
    } else {
      await this.interactions!.type(text);
    }
  }

  /** Fill an element with text */
  async fill(ref: string, text: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    await this.interactions!.fill(nodeRef.backendDOMNodeId, text);
  }

  /** Press a key combination */
  async key(combo: string, repeat?: number): Promise<void> {
    await this.interactions!.key(combo, repeat);
  }

  /** Scroll in a direction */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', options: { amount?: number; on?: string } = {}): Promise<void> {
    let atX: number | undefined;
    let atY: number | undefined;

    if (options.on) {
      const nodeRef = this.resolveRef(options.on);
      const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
      atX = bounds[0] + bounds[2] / 2;
      atY = bounds[1] + bounds[3] / 2;
    }

    await this.interactions!.scroll(direction, options.amount, atX, atY);
  }

  /** Select a value in a dropdown */
  async select(ref: string, value: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    await this.interactions!.select(nodeRef.backendDOMNodeId, value);
  }

  /** Check a checkbox */
  async check(ref: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
    await this.interactions!.check(nodeRef.backendDOMNodeId, bounds);
  }

  /** Uncheck a checkbox */
  async uncheck(ref: string): Promise<void> {
    const nodeRef = this.resolveRef(ref);
    const bounds = await this.getCSSBounds(nodeRef.backendDOMNodeId);
    await this.interactions!.uncheck(nodeRef.backendDOMNodeId, bounds);
  }

  /** Check if UI changed since last snapshot */
  async changed(): Promise<boolean> {
    if (!this.axTree || this.lastElements.length === 0) return true;
    const { elements } = await this.axTree.getTree({});
    return computeChanged(this.lastElements, elements);
  }

  /** Get diff since last snapshot */
  async diff(): Promise<ReturnType<typeof computeDiff>> {
    if (!this.axTree || this.lastElements.length === 0) {
      return { changed: true, added: [], removed: [], modified: [] };
    }
    const { elements } = await this.axTree.getTree({});
    return computeDiff(this.lastElements, elements);
  }

  /** Find elements by text in last snapshot */
  find(text: string, options: { role?: string; first?: boolean } = {}): { elements: Element[] } {
    const lowerText = text.toLowerCase();
    let results = this.flattenElements(this.lastElements).filter(el => {
      const matchText = (el.label?.toLowerCase().includes(lowerText)) ||
                       (el.value?.toLowerCase().includes(lowerText));
      if (!matchText) return false;
      if (options.role && el.role !== options.role) return false;
      return true;
    });

    if (options.first && results.length > 0) {
      results = [results[0]];
    }

    return { elements: results };
  }

  /** Read element value from last snapshot */
  read(ref: string, attr?: string): { ref: string; value: unknown } {
    const el = this.findElementByRef(ref);
    if (!el) throw new Error(`Element not found: ${ref}`);

    if (attr === 'label') return { ref, value: el.label };
    if (attr === 'role') return { ref, value: el.role };
    if (attr === 'enabled') return { ref, value: el.enabled };
    if (attr === 'focused') return { ref, value: el.focused };
    return { ref, value: el.value };
  }

  /** Get element bounds */
  async box(ref: string): Promise<{ ref: string; bounds: [number, number, number, number] }> {
    const el = this.findElementByRef(ref);
    if (!el) throw new Error(`Element not found: ${ref}`);
    return { ref, bounds: el.bounds };
  }

  /** Check element state */
  is(state: string, ref: string): { state: string; value: boolean } {
    const el = this.findElementByRef(ref);
    if (!el) throw new Error(`Element not found: ${ref}`);

    switch (state) {
      case 'enabled': return { state, value: el.enabled };
      case 'focused': return { state, value: el.focused };
      case 'visible': return { state, value: el.bounds[2] > 0 && el.bounds[3] > 0 };
      default: return { state, value: false };
    }
  }

  /** Get children of an element from last snapshot */
  children(ref: string): { ref: string; children: Element[] } {
    const el = this.findElementByRef(ref);
    if (!el) throw new Error(`Element not found: ${ref}`);
    return { ref, children: el.children ?? [] };
  }

  /** Get the underlying connection (for advanced usage) */
  getConnection(): CDPConnection {
    return this.connection;
  }

  /** Get the last ref map */
  getLastRefMap(): Map<string, CDPNodeRef> {
    return this.lastRefMap;
  }

  // --- Private helpers ---

  private resolveRef(ref: string): CDPNodeRef {
    const nodeRef = this.lastRefMap.get(ref);
    if (!nodeRef) {
      throw new Error(`CDP ref not found: ${ref}. Take a snapshot first.`);
    }
    return nodeRef;
  }

  private async getCSSBounds(backendDOMNodeId: number): Promise<[number, number, number, number]> {
    return getBounds(this.connection, backendDOMNodeId);
  }

  private async updateContentOffset(): Promise<void> {
    try {
      const result = await this.connection.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ x: window.screenX, y: window.screenY })',
        returnByValue: true,
      }) as { result: { value: string } };

      const parsed = JSON.parse(result.result.value);
      this.contentOffset = { x: parsed.x ?? 0, y: parsed.y ?? 0 };
    } catch {
      this.contentOffset = { x: 0, y: 0 };
    }
  }

  private flattenElements(elements: Element[]): Element[] {
    const result: Element[] = [];
    const walk = (els: Element[]) => {
      for (const el of els) {
        result.push(el);
        if (el.children) walk(el.children);
      }
    };
    walk(elements);
    return result;
  }

  private findElementByRef(ref: string): Element | undefined {
    return this.flattenElements(this.lastElements).find(el => el.ref === ref);
  }
}
