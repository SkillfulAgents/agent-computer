import Foundation
import ApplicationServices
import AppKit
import Carbon.HIToolbox

// MARK: - Keyboard Actions

class Keyboard {

    // MARK: - Key Name → Keycode Mapping

    private static let KEY_MAP: [String: CGKeyCode] = [
        "return": 0x24, "enter": 0x24,
        "tab": 0x30,
        "space": 0x31,
        "delete": 0x33, "backspace": 0x33,
        "escape": 0x35, "esc": 0x35,
        "f1": 0x7A, "f2": 0x78, "f3": 0x63, "f4": 0x76,
        "f5": 0x60, "f6": 0x61, "f7": 0x62, "f8": 0x64,
        "f9": 0x65, "f10": 0x6D, "f11": 0x67, "f12": 0x6F,
        "up": 0x7E, "down": 0x7D, "left": 0x7B, "right": 0x7C,
        "home": 0x73, "end": 0x77,
        "pageup": 0x74, "pagedown": 0x79,
        "forwarddelete": 0x75,
        // Letter keys
        "a": 0x00, "b": 0x0B, "c": 0x08, "d": 0x02,
        "e": 0x0E, "f": 0x03, "g": 0x05, "h": 0x04,
        "i": 0x22, "j": 0x26, "k": 0x28, "l": 0x25,
        "m": 0x2E, "n": 0x2D, "o": 0x1F, "p": 0x23,
        "q": 0x0C, "r": 0x0F, "s": 0x01, "t": 0x11,
        "u": 0x20, "v": 0x09, "w": 0x0D, "x": 0x07,
        "y": 0x10, "z": 0x06,
        // Number keys
        "0": 0x1D, "1": 0x12, "2": 0x13, "3": 0x14,
        "4": 0x15, "5": 0x17, "6": 0x16, "7": 0x1A,
        "8": 0x1C, "9": 0x19,
        // Punctuation
        "-": 0x1B, "=": 0x18, "[": 0x21, "]": 0x1E,
        "\\": 0x2A, ";": 0x29, "'": 0x27, ",": 0x2B,
        ".": 0x2F, "/": 0x2C, "`": 0x32,
        // Modifier keys (for keydown/keyup)
        "shift": 0x38, "cmd": 0x37, "command": 0x37,
        "opt": 0x3A, "option": 0x3A, "alt": 0x3A,
        "ctrl": 0x3B, "control": 0x3B,
        "fn": 0x3F,
    ]

    // Characters that require Shift
    private static let SHIFT_CHARS: [Character: String] = [
        "!": "1", "@": "2", "#": "3", "$": "4", "%": "5",
        "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
        "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\",
        ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/",
        "~": "`",
    ]

    /// Type text by simulating individual keystrokes via CGEvent
    static func typeText(
        text: String,
        delay: Int? // milliseconds between keystrokes
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        for char in text {
            let str = String(char)
            let lower = str.lowercased()

            // Check if character needs shift
            var needsShift = char.isUppercase
            var keyToLookup = lower

            if let shiftBase = SHIFT_CHARS[char] {
                needsShift = true
                keyToLookup = shiftBase
            }

            if let keyCode = KEY_MAP[keyToLookup] {
                // Use proper virtual key code
                guard let downEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true),
                      let upEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else {
                    continue
                }

                if needsShift {
                    downEvent.flags = .maskShift
                    upEvent.flags = .maskShift
                }

                downEvent.post(tap: .cghidEventTap)
                upEvent.post(tap: .cghidEventTap)
            } else {
                // Fallback: Unicode string approach for non-ASCII characters
                guard let downEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
                      let upEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else {
                    continue
                }

                var unicodeChars = Array(str.utf16)
                downEvent.keyboardSetUnicodeString(stringLength: unicodeChars.count, unicodeString: &unicodeChars)
                upEvent.keyboardSetUnicodeString(stringLength: unicodeChars.count, unicodeString: &unicodeChars)

                downEvent.post(tap: .cghidEventTap)
                upEvent.post(tap: .cghidEventTap)
            }

            if let delay = delay, delay > 0 {
                Thread.sleep(forTimeInterval: Double(delay) / 1000.0)
            }
        }

        return (["ok": true, "length": text.count], nil)
    }

    /// Fill an element: focus it, clear existing content, type new text
    static func fill(
        ref: String,
        text: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        // Try to set value directly via AX (most reliable for text fields)
        let setResult = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFTypeRef)

        if setResult == .success {
            return (["ok": true, "ref": ref, "method": "ax_set_value"], nil)
        }

        // Fallback: focus, select all, type
        // Focus the element
        AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, true as CFTypeRef)
        Thread.sleep(forTimeInterval: 0.1)

        // Select all (Cmd+A)
        pressKey(combo: "cmd+a")
        Thread.sleep(forTimeInterval: 0.05)

        // Type the new text
        let (_, typeError) = typeText(text: text, delay: nil)
        if let typeError = typeError {
            return (nil, typeError)
        }

        return (["ok": true, "ref": ref, "method": "focus_select_type"], nil)
    }

    /// Press a key combination (e.g. "cmd+s", "cmd+shift+t", "enter")
    static func pressKey(combo: String) {
        let parts = combo.lowercased().split(separator: "+").map(String.init)

        // Separate modifiers from the key
        var modifiers: [String] = []
        var keyName = ""

        for part in parts {
            if isModifier(part) {
                modifiers.append(part)
            } else {
                keyName = part
            }
        }

        // If no non-modifier key, the modifier itself is the key (e.g. just "shift")
        if keyName.isEmpty && !modifiers.isEmpty {
            keyName = modifiers.removeLast()
        }

        // Get keycode
        guard let keyCode = KEY_MAP[keyName] else {
            return  // Unknown key
        }

        // Build modifier flags
        var flags = CGEventFlags()
        for mod in modifiers {
            switch mod {
            case "cmd", "command": flags.insert(.maskCommand)
            case "shift": flags.insert(.maskShift)
            case "opt", "option", "alt": flags.insert(.maskAlternate)
            case "ctrl", "control": flags.insert(.maskControl)
            case "fn": flags.insert(.maskSecondaryFn)
            default: break
            }
        }

        guard let downEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true),
              let upEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false) else {
            return
        }

        if flags != [] {
            downEvent.flags = flags
            upEvent.flags = flags
        }

        downEvent.post(tap: .cghidEventTap)
        upEvent.post(tap: .cghidEventTap)
    }

    /// Press a key combo with repeat count and optional delay
    static func key(
        combo: String,
        repeat count: Int,
        delay: Int?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        for i in 0..<count {
            pressKey(combo: combo)
            if i < count - 1 {
                let d = delay ?? 50
                Thread.sleep(forTimeInterval: Double(d) / 1000.0)
            }
        }

        return (["ok": true, "combo": combo, "count": count], nil)
    }

    /// Hold a key down or release it
    static func keyUpDown(
        key: String,
        down: Bool
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        let keyLower = key.lowercased()
        guard let keyCode = KEY_MAP[keyLower] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Unknown key: \(key)"))
        }

        guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: down) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to create keyboard event"))
        }

        // Add modifier flag if the key itself is a modifier
        if isModifier(keyLower) {
            switch keyLower {
            case "cmd", "command": event.flags = .maskCommand
            case "shift": event.flags = .maskShift
            case "opt", "option", "alt": event.flags = .maskAlternate
            case "ctrl", "control": event.flags = .maskControl
            default: break
            }
        }

        event.post(tap: .cghidEventTap)

        return (["ok": true, "key": key, "action": down ? "down" : "up"], nil)
    }

    /// Set clipboard and paste (Cmd+V), then restore original clipboard
    static func paste(text: String) -> (result: [String: Any]?, error: RPCResponse?) {
        let pasteboard = NSPasteboard.general

        // Save original clipboard
        let originalString = pasteboard.string(forType: .string)

        // Set new content
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)

        // Small delay to let pasteboard settle
        Thread.sleep(forTimeInterval: 0.05)

        // Press Cmd+V
        pressKey(combo: "cmd+v")

        // Wait for paste to complete
        Thread.sleep(forTimeInterval: 0.1)

        // Restore original clipboard
        pasteboard.clearContents()
        if let original = originalString {
            pasteboard.setString(original, forType: .string)
        }

        return (["ok": true, "length": text.count], nil)
    }

    // MARK: - Helpers

    private static func isModifier(_ key: String) -> Bool {
        return ["cmd", "command", "shift", "opt", "option", "alt", "ctrl", "control", "fn"].contains(key)
    }
}
