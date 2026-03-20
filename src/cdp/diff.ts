import type { Element } from '../types.js';

/** Quick check if anything changed between two element arrays */
export function computeChanged(prev: Element[], curr: Element[]): boolean {
  if (prev.length !== curr.length) return true;

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const c = curr[i];
    if (p.ref !== c.ref || p.role !== c.role || p.label !== c.label ||
        p.value !== c.value || p.enabled !== c.enabled || p.focused !== c.focused) {
      return true;
    }
  }
  return false;
}

/** Detailed diff between two element arrays */
export function computeDiff(
  prev: Element[],
  curr: Element[]
): { changed: boolean; added: Element[]; removed: Element[]; modified: Array<{ ref: string; changes: Record<string, { from: unknown; to: unknown }> }> } {
  const prevMap = new Map(prev.map(e => [e.ref, e]));
  const currMap = new Map(curr.map(e => [e.ref, e]));

  const added: Element[] = [];
  const removed: Element[] = [];
  const modified: Array<{ ref: string; changes: Record<string, { from: unknown; to: unknown }> }> = [];

  // Find added and modified
  for (const [ref, el] of currMap) {
    const prevEl = prevMap.get(ref);
    if (!prevEl) {
      added.push(el);
    } else {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (prevEl.label !== el.label) changes.label = { from: prevEl.label, to: el.label };
      if (prevEl.value !== el.value) changes.value = { from: prevEl.value, to: el.value };
      if (prevEl.enabled !== el.enabled) changes.enabled = { from: prevEl.enabled, to: el.enabled };
      if (prevEl.focused !== el.focused) changes.focused = { from: prevEl.focused, to: el.focused };
      if (Object.keys(changes).length > 0) {
        modified.push({ ref, changes });
      }
    }
  }

  // Find removed
  for (const [ref, el] of prevMap) {
    if (!currMap.has(ref)) {
      removed.push(el);
    }
  }

  const changed = added.length > 0 || removed.length > 0 || modified.length > 0;
  return { changed, added, removed, modified };
}
