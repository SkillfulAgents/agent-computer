import Foundation
import AppKit

// MARK: - Clipboard Operations

class ClipboardManager {

    /// Read the current clipboard text
    static func read() -> (result: [String: Any]?, error: RPCResponse?) {
        let pasteboard = NSPasteboard.general
        let text = pasteboard.string(forType: .string)
        return (["ok": true, "text": text as Any], nil)
    }

    /// Set the clipboard to the given text
    static func set(text: String) -> (result: [String: Any]?, error: RPCResponse?) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        return (["ok": true], nil)
    }

    /// Simulate Cmd+C (copy current selection)
    static func copy() -> (result: [String: Any]?, error: RPCResponse?) {
        Keyboard.pressKey(combo: "cmd+c")
        Thread.sleep(forTimeInterval: 0.1) // Let clipboard settle
        let text = NSPasteboard.general.string(forType: .string)
        return (["ok": true, "text": text as Any], nil)
    }
}
