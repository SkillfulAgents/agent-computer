"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeChanged = computeChanged;
exports.computeDiff = computeDiff;
/** Quick check if anything changed between two element arrays */
function computeChanged(prev, curr) {
    if (prev.length !== curr.length)
        return true;
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
function computeDiff(prev, curr) {
    const prevMap = new Map(prev.map(e => [e.ref, e]));
    const currMap = new Map(curr.map(e => [e.ref, e]));
    const added = [];
    const removed = [];
    const modified = [];
    // Find added and modified
    for (const [ref, el] of currMap) {
        const prevEl = prevMap.get(ref);
        if (!prevEl) {
            added.push(el);
        }
        else {
            const changes = {};
            if (prevEl.label !== el.label)
                changes.label = { from: prevEl.label, to: el.label };
            if (prevEl.value !== el.value)
                changes.value = { from: prevEl.value, to: el.value };
            if (prevEl.enabled !== el.enabled)
                changes.enabled = { from: prevEl.enabled, to: el.enabled };
            if (prevEl.focused !== el.focused)
                changes.focused = { from: prevEl.focused, to: el.focused };
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
