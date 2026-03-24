"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBounds = getBounds;
exports.toScreenCoords = toScreenCoords;
exports.resolveAllBounds = resolveAllBounds;
/**
 * Fetch the CSS bounding box for a DOM node via CDP DOM.getBoxModel.
 * Returns [x, y, width, height] from the content quad.
 * Returns [0, 0, 0, 0] if the box model cannot be retrieved.
 */
async function getBounds(connection, backendDOMNodeId) {
    try {
        const result = (await connection.send('DOM.getBoxModel', {
            backendNodeId: backendDOMNodeId,
        }));
        const content = result.model.content;
        // Content quad: [x1,y1, x2,y2, x3,y3, x4,y4]
        const x = content[0];
        const y = content[1];
        const w = content[2] - content[0];
        const h = content[7] - content[1];
        return [x, y, w, h];
    }
    catch {
        return [0, 0, 0, 0];
    }
}
/**
 * Convert CSS-pixel bounds to screen coordinates.
 */
function toScreenCoords(cssBounds, windowBounds, contentOffset, scaleFactor) {
    const screenX = (cssBounds[0] + contentOffset.x) * scaleFactor + windowBounds[0];
    const screenY = (cssBounds[1] + contentOffset.y) * scaleFactor + windowBounds[1];
    const screenW = cssBounds[2] * scaleFactor;
    const screenH = cssBounds[3] * scaleFactor;
    return [screenX, screenY, screenW, screenH];
}
const CONCURRENCY_LIMIT = 50;
/**
 * Batch-resolve bounds for all elements that have entries in refMap.
 * Mutates elements in-place, updating their `bounds` field.
 */
async function resolveAllBounds(connection, elements, refMap, windowBounds, contentOffset, scaleFactor) {
    // Collect all (element, nodeRef) pairs by flattening the tree
    const work = [];
    const collectWork = (els) => {
        for (const el of els) {
            const nodeRef = refMap.get(el.ref);
            if (nodeRef) {
                work.push({ element: el, nodeRef });
            }
            if (el.children) {
                collectWork(el.children);
            }
        }
    };
    collectWork(elements);
    // Process in batches with concurrency limit
    for (let i = 0; i < work.length; i += CONCURRENCY_LIMIT) {
        const batch = work.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(async ({ element, nodeRef }) => {
            const cssBounds = await getBounds(connection, nodeRef.backendDOMNodeId);
            element.bounds = toScreenCoords(cssBounds, windowBounds, contentOffset, scaleFactor);
        }));
    }
}
