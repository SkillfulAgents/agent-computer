"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPInteractions = void 0;
// Modifier flag values for CDP Input events
const MODIFIER_FLAGS = {
    alt: 1,
    ctrl: 2,
    meta: 4, // Cmd on Mac
    shift: 8,
};
// Key name mapping for special keys
const KEY_MAP = {
    enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
    return: { key: 'Enter', code: 'Enter', keyCode: 13 },
    tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    esc: { key: 'Escape', code: 'Escape', keyCode: 27 },
    backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
    delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
    space: { key: ' ', code: 'Space', keyCode: 32 },
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    home: { key: 'Home', code: 'Home', keyCode: 36 },
    end: { key: 'End', code: 'End', keyCode: 35 },
    pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    // Letters a-z will be handled dynamically
};
class CDPInteractions {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    /** Click at element center (CSS viewport coords). Options: right, double, modifiers */
    async click(backendDOMNodeId, cssBounds, options = {}) {
        const x = cssBounds[0] + cssBounds[2] / 2;
        const y = cssBounds[1] + cssBounds[3] / 2;
        await this.clickAt(x, y, options);
    }
    /** Click at specific CSS viewport coords */
    async clickAt(x, y, options = {}) {
        const button = options.right ? 'right' : 'left';
        const clickCount = options.double ? 2 : (options.count ?? 1);
        const modifiers = this.computeModifiers(options.modifiers);
        // Move mouse first
        await this.connection.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x, y,
            modifiers,
        });
        // For double click, send two full click sequences
        for (let i = 0; i < clickCount; i++) {
            await this.connection.send('Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x, y,
                button,
                clickCount: i + 1,
                modifiers,
            });
            await this.connection.send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x, y,
                button,
                clickCount: i + 1,
                modifiers,
            });
        }
    }
    /** Hover over element (move mouse to center) */
    async hover(cssBounds) {
        const x = cssBounds[0] + cssBounds[2] / 2;
        const y = cssBounds[1] + cssBounds[3] / 2;
        await this.connection.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x, y,
        });
    }
    /** Focus an element by backendNodeId */
    async focus(backendDOMNodeId) {
        await this.connection.send('DOM.focus', { backendNodeId: backendDOMNodeId });
    }
    /** Insert text at current focus (fast, no key events) */
    async type(text) {
        await this.connection.send('Input.insertText', { text });
    }
    /** Type with per-character key events and optional delay */
    async typeWithDelay(text, delay) {
        for (const char of text) {
            await this.connection.send('Input.dispatchKeyEvent', {
                type: 'keyDown',
                key: char,
                text: char,
            });
            await this.connection.send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: char,
            });
            if (delay > 0) {
                await sleep(delay);
            }
        }
    }
    /** Fill: focus element, select all, insert text. Fallback: set .value via Runtime */
    async fill(backendDOMNodeId, text) {
        // Focus the element
        await this.focus(backendDOMNodeId);
        await sleep(50);
        // Select all (Cmd+A on Mac)
        await this.key('cmd+a');
        await sleep(50);
        // Insert text (replaces selection)
        await this.type(text);
    }
    /** Press a key combination (e.g., "cmd+a", "shift+enter", "ctrl+c") */
    async key(combo, repeat) {
        const times = repeat ?? 1;
        const { modifiers, keyInfo } = this.parseCombo(combo);
        for (let i = 0; i < times; i++) {
            // Press modifier keys
            for (const mod of modifiers) {
                await this.connection.send('Input.dispatchKeyEvent', {
                    type: 'rawKeyDown',
                    key: this.modifierKeyName(mod),
                    modifiers: this.computeModifiers(modifiers),
                });
            }
            // Press the main key
            const modifierFlags = this.computeModifiers(modifiers);
            await this.connection.send('Input.dispatchKeyEvent', {
                type: 'rawKeyDown',
                key: keyInfo.key,
                code: keyInfo.code,
                windowsVirtualKeyCode: keyInfo.keyCode,
                modifiers: modifierFlags,
            });
            // If it's a printable character with no modifiers (or just shift), send char event
            if (keyInfo.key.length === 1 && modifiers.every(m => m === 'shift')) {
                await this.connection.send('Input.dispatchKeyEvent', {
                    type: 'char',
                    key: keyInfo.key,
                    text: keyInfo.key,
                    modifiers: modifierFlags,
                });
            }
            await this.connection.send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: keyInfo.key,
                code: keyInfo.code,
                windowsVirtualKeyCode: keyInfo.keyCode,
                modifiers: modifierFlags,
            });
            // Release modifier keys (reverse order)
            for (const mod of [...modifiers].reverse()) {
                await this.connection.send('Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    key: this.modifierKeyName(mod),
                    modifiers: 0,
                });
            }
            if (i < times - 1)
                await sleep(50);
        }
    }
    /** Scroll using mouseWheel events */
    async scroll(direction, amount = 3, atX, atY) {
        const x = atX ?? 300; // center of typical window
        const y = atY ?? 250;
        const pixelAmount = amount * 100; // Each "amount" unit = 100px
        let deltaX = 0;
        let deltaY = 0;
        switch (direction) {
            case 'up':
                deltaY = -pixelAmount;
                break;
            case 'down':
                deltaY = pixelAmount;
                break;
            case 'left':
                deltaX = -pixelAmount;
                break;
            case 'right':
                deltaX = pixelAmount;
                break;
        }
        await this.connection.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x, y,
            deltaX,
            deltaY,
        });
    }
    /** Select a value in a <select> element */
    async select(backendDOMNodeId, value) {
        // Resolve to a remote object first
        const { object } = await this.connection.send('DOM.resolveNode', {
            backendNodeId: backendDOMNodeId,
        });
        await this.connection.send('Runtime.callFunctionOn', {
            objectId: object.objectId,
            functionDeclaration: `function(val) {
        for (let i = 0; i < this.options.length; i++) {
          if (this.options[i].value === val || this.options[i].text === val) {
            this.selectedIndex = i;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      }`,
            arguments: [{ value }],
        });
    }
    /** Check a checkbox (click if not already checked) */
    async check(backendDOMNodeId, cssBounds) {
        const checked = await this.getCheckedState(backendDOMNodeId);
        if (!checked) {
            await this.click(backendDOMNodeId, cssBounds);
        }
    }
    /** Uncheck a checkbox (click if currently checked) */
    async uncheck(backendDOMNodeId, cssBounds) {
        const checked = await this.getCheckedState(backendDOMNodeId);
        if (checked) {
            await this.click(backendDOMNodeId, cssBounds);
        }
    }
    /** Get .checked state of an element via Runtime */
    async getCheckedState(backendDOMNodeId) {
        const { object } = await this.connection.send('DOM.resolveNode', {
            backendNodeId: backendDOMNodeId,
        });
        const result = await this.connection.send('Runtime.callFunctionOn', {
            objectId: object.objectId,
            functionDeclaration: 'function() { return this.checked; }',
            returnByValue: true,
        });
        return result.result.value === true;
    }
    /** Parse key combo string like "cmd+shift+a" */
    parseCombo(combo) {
        const parts = combo.toLowerCase().split('+');
        const modifiers = [];
        let mainKey = '';
        for (const part of parts) {
            const p = part.trim();
            if (p === 'cmd' || p === 'command' || p === 'meta') {
                modifiers.push('meta');
            }
            else if (p === 'ctrl' || p === 'control') {
                modifiers.push('ctrl');
            }
            else if (p === 'alt' || p === 'option' || p === 'opt') {
                modifiers.push('alt');
            }
            else if (p === 'shift') {
                modifiers.push('shift');
            }
            else {
                mainKey = p;
            }
        }
        const keyInfo = KEY_MAP[mainKey] ?? this.letterKeyInfo(mainKey);
        return { modifiers, keyInfo };
    }
    letterKeyInfo(key) {
        if (key.length === 1) {
            const upper = key.toUpperCase();
            return {
                key: key,
                code: `Key${upper}`,
                keyCode: upper.charCodeAt(0),
            };
        }
        // Unknown key - pass through
        return { key, code: key, keyCode: 0 };
    }
    modifierKeyName(mod) {
        switch (mod) {
            case 'meta': return 'Meta';
            case 'ctrl': return 'Control';
            case 'alt': return 'Alt';
            case 'shift': return 'Shift';
            default: return mod;
        }
    }
    computeModifiers(mods) {
        if (!mods)
            return 0;
        let flags = 0;
        for (const mod of mods) {
            flags |= MODIFIER_FLAGS[mod] ?? 0;
        }
        return flags;
    }
}
exports.CDPInteractions = CDPInteractions;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
