"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REF_PREFIXES = void 0;
exports.roleToPrefix = roleToPrefix;
exports.parseRef = parseRef;
exports.isValidRef = isValidRef;
exports.refToRole = refToRole;
// Single-letter prefix → role mapping
const SINGLE_LETTER_PREFIXES = {
    b: 'button',
    t: 'textfield',
    l: 'link',
    m: 'menuitem',
    c: 'checkbox',
    r: 'radio',
    s: 'slider',
    d: 'dropdown',
    i: 'image',
    g: 'group',
    w: 'window',
    x: 'table',
    o: 'row',
    a: 'tab',
    e: 'generic',
};
// Two-letter prefix → role mapping (for less common roles)
const TWO_LETTER_PREFIXES = {
    cb: 'combobox',
    sa: 'scrollarea',
    st: 'stepper',
    sp: 'splitgroup',
    tl: 'timeline',
    pg: 'progress',
    tv: 'treeview',
    wb: 'webarea',
};
exports.REF_PREFIXES = {
    ...SINGLE_LETTER_PREFIXES,
    ...TWO_LETTER_PREFIXES,
};
// Reverse mapping: role → prefix
const ROLE_TO_PREFIX = {};
for (const [prefix, role] of Object.entries(exports.REF_PREFIXES)) {
    // Prefer shorter prefix if role already mapped
    if (!ROLE_TO_PREFIX[role] || prefix.length < ROLE_TO_PREFIX[role].length) {
        ROLE_TO_PREFIX[role] = prefix;
    }
}
// textfield and textarea both map to 't' — textarea gets 't' by convention
ROLE_TO_PREFIX['textarea'] = 't';
function roleToPrefix(role) {
    return ROLE_TO_PREFIX[role] ?? 'e';
}
const ALL_PREFIXES = new Set(Object.keys(exports.REF_PREFIXES));
// Ref pattern: @<prefix><positive integer>
// Try two-letter prefix first, then single-letter
const REF_REGEX = /^@([a-z]{1,2})([1-9]\d*)$/;
function parseRef(input) {
    const match = REF_REGEX.exec(input);
    if (!match) {
        throw new Error(`Invalid ref format: "${input}". Expected @<prefix><number> (e.g., @b1, @cb3)`);
    }
    const rawPrefix = match[1];
    const id = parseInt(match[2], 10);
    // Try two-letter prefix first (e.g., "@cb1" → prefix "cb", not "c" with "b1")
    if (rawPrefix.length === 2 && ALL_PREFIXES.has(rawPrefix)) {
        return { prefix: rawPrefix, role: exports.REF_PREFIXES[rawPrefix], id };
    }
    // Try single-letter prefix
    if (rawPrefix.length === 1 && ALL_PREFIXES.has(rawPrefix)) {
        return { prefix: rawPrefix, role: exports.REF_PREFIXES[rawPrefix], id };
    }
    // Two-letter prefix but only first letter is valid (e.g., "@bx1" is not valid)
    if (rawPrefix.length === 2) {
        // Check if first letter alone is a valid prefix — if so, reject because the second char is part of the number parsing issue
        throw new Error(`Invalid ref prefix: "${rawPrefix}" in "${input}". Valid prefixes: ${[...ALL_PREFIXES].sort().join(', ')}`);
    }
    throw new Error(`Unknown ref prefix: "${rawPrefix}" in "${input}". Valid prefixes: ${[...ALL_PREFIXES].sort().join(', ')}`);
}
function isValidRef(input) {
    try {
        parseRef(input);
        return true;
    }
    catch {
        return false;
    }
}
function refToRole(prefix) {
    return exports.REF_PREFIXES[prefix];
}
