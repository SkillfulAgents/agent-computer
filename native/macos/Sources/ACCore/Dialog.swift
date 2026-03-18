import Foundation
import ApplicationServices
import AppKit

// MARK: - Dialog & Alert Handling

class Dialog {

    /// Detect if there's an alert/dialog visible in the frontmost app or specified app
    static func detect(appName: String?) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let app = resolveApp(appName: appName) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.appNotFound,
                message: "Could not find app\(appName.map { ": \($0)" } ?? "")"))
        }

        let appElement = AXUIElementCreateApplication(app.processIdentifier)

        // Check for sheets (attached dialogs like Save)
        if let sheet = findSheet(in: appElement) {
            let info = describeDialog(sheet, type: "sheet")
            return (["ok": true, "found": true, "dialog": info], nil)
        }

        // Check for modal windows (standalone dialogs)
        if let modal = findModalWindow(in: appElement) {
            let info = describeDialog(modal, type: "modal")
            return (["ok": true, "found": true, "dialog": info], nil)
        }

        // Check for system alerts
        if let alert = findAlert(in: appElement) {
            let info = describeDialog(alert, type: "alert")
            return (["ok": true, "found": true, "dialog": info], nil)
        }

        return (["ok": true, "found": false], nil)
    }

    /// Accept/dismiss the current dialog (click default button or cancel)
    static func respond(action: String, appName: String?) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let app = resolveApp(appName: appName) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.appNotFound,
                message: "Could not find app\(appName.map { ": \($0)" } ?? "")"))
        }

        let appElement = AXUIElementCreateApplication(app.processIdentifier)

        // Find the dialog element
        guard let dialog = findSheet(in: appElement) ?? findModalWindow(in: appElement) ?? findAlert(in: appElement) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "No dialog found"))
        }

        switch action {
        case "accept", "ok", "yes":
            // Find the default button (or first button with "OK", "Save", "Yes", etc.)
            if let button = findDefaultButton(in: dialog) {
                AXUIElementPerformAction(button, kAXPressAction as CFString)
                return (["ok": true, "action": "accept"], nil)
            }
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "No accept button found in dialog"))

        case "cancel", "dismiss", "no":
            if let button = findCancelButton(in: dialog) {
                AXUIElementPerformAction(button, kAXPressAction as CFString)
                return (["ok": true, "action": "cancel"], nil)
            }
            // Fall back to Escape key
            Keyboard.pressKey(combo: "escape")
            return (["ok": true, "action": "cancel", "method": "escape"], nil)

        case "click":
            // Generic — caller should use menu_click or click command instead
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Use 'accept' or 'cancel'. For specific buttons, use click command with a ref."))

        default:
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Unknown action: \(action). Use 'accept' or 'cancel'."))
        }
    }

    /// Handle a file dialog — set the filename/path
    static func fileDialog(path: String, appName: String?) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let app = resolveApp(appName: appName) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.appNotFound,
                message: "Could not find app\(appName.map { ": \($0)" } ?? "")"))
        }

        let appElement = AXUIElementCreateApplication(app.processIdentifier)

        // Find the sheet/dialog with a text field (filename input)
        guard let dialog = findSheet(in: appElement) ?? findModalWindow(in: appElement) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "No file dialog found"))
        }

        // Find the filename text field in the dialog
        guard let textField = findTextField(in: dialog) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "No filename text field found in dialog"))
        }

        // Set the filename
        AXUIElementSetAttributeValue(textField, kAXFocusedAttribute as CFString, true as CFTypeRef)
        Thread.sleep(forTimeInterval: 0.1)

        // Select all existing text and replace
        AXUIElementSetAttributeValue(textField, kAXValueAttribute as CFString, path as CFTypeRef)
        Thread.sleep(forTimeInterval: 0.1)

        return (["ok": true, "path": path], nil)
    }

    // MARK: - Helpers

    private static func resolveApp(appName: String?) -> NSRunningApplication? {
        if let appName = appName {
            return NSWorkspace.shared.runningApplications.first {
                $0.localizedName?.lowercased() == appName.lowercased()
            }
        }
        return NSWorkspace.shared.frontmostApplication
    }

    private static func findSheet(in appElement: AXUIElement) -> AXUIElement? {
        // Get windows and check for sheets
        var windowsRef: CFTypeRef?
        AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard let windows = windowsRef as? [AXUIElement] else { return nil }

        for window in windows {
            // Check for sheet children
            var childrenRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXChildrenAttribute as CFString, &childrenRef)
            if let children = childrenRef as? [AXUIElement] {
                for child in children {
                    var roleRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
                    if let role = roleRef as? String, role == "AXSheet" {
                        return child
                    }
                }
            }
        }
        return nil
    }

    private static func findModalWindow(in appElement: AXUIElement) -> AXUIElement? {
        var windowsRef: CFTypeRef?
        AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard let windows = windowsRef as? [AXUIElement] else { return nil }

        for window in windows {
            // Only detect truly modal windows (AXModal attribute set to true)
            var modalRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXModalAttribute as CFString, &modalRef)
            if let isModal = modalRef as? Bool, isModal {
                return window
            }
        }
        return nil
    }

    private static func findAlert(in appElement: AXUIElement) -> AXUIElement? {
        var windowsRef: CFTypeRef?
        AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard let windows = windowsRef as? [AXUIElement] else { return nil }

        for window in windows {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXRoleAttribute as CFString, &roleRef)
            if let role = roleRef as? String, role == "AXSheet" || role == "AXDialog" {
                return window
            }
        }
        return nil
    }

    private static func describeDialog(_ element: AXUIElement, type: String) -> [String: Any] {
        var info: [String: Any] = ["type": type]

        // Get title
        var titleRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleRef)
        if let title = titleRef as? String, !title.isEmpty {
            info["title"] = title
        }

        // Get description/value
        var descRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef)
        if let desc = descRef as? String, !desc.isEmpty {
            info["description"] = desc
        }

        // Find buttons in the dialog
        var buttons: [[String: Any]] = []
        collectButtons(in: element, buttons: &buttons, depth: 0)
        if !buttons.isEmpty {
            info["buttons"] = buttons
        }

        // Find static text (message)
        var texts: [String] = []
        collectStaticText(in: element, texts: &texts, depth: 0)
        if !texts.isEmpty {
            info["message"] = texts.joined(separator: " ")
        }

        return info
    }

    private static func collectButtons(in element: AXUIElement, buttons: inout [[String: Any]], depth: Int) {
        guard depth < 5 else { return }
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return }

        for child in children {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            if let role = roleRef as? String, role == "AXButton" {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXTitleAttribute as CFString, &titleRef)
                let title = titleRef as? String ?? ""
                if !title.isEmpty {
                    buttons.append(["title": title])
                }
            }
            collectButtons(in: child, buttons: &buttons, depth: depth + 1)
        }
    }

    private static func collectStaticText(in element: AXUIElement, texts: inout [String], depth: Int) {
        guard depth < 5 else { return }
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return }

        for child in children {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            if let role = roleRef as? String, role == "AXStaticText" {
                var valueRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXValueAttribute as CFString, &valueRef)
                if let value = valueRef as? String, !value.isEmpty {
                    texts.append(value)
                }
            }
            collectStaticText(in: child, texts: &texts, depth: depth + 1)
        }
    }

    private static func findDefaultButton(in element: AXUIElement) -> AXUIElement? {
        // Look for AXDefaultButton attribute first
        var defaultRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXDefaultButtonAttribute as CFString, &defaultRef)
        if let defaultButton = defaultRef {
            return (defaultButton as! AXUIElement)
        }

        // Search for buttons with common accept titles
        let acceptTitles = ["ok", "save", "yes", "done", "open", "allow", "continue",
                           "replace", "don't save", "delete", "remove", "confirm"]
        return findButtonByTitle(in: element, titles: acceptTitles, depth: 0)
    }

    private static func findCancelButton(in element: AXUIElement) -> AXUIElement? {
        // Look for AXCancelButton attribute first
        var cancelRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXCancelButtonAttribute as CFString, &cancelRef)
        if let cancelButton = cancelRef {
            return (cancelButton as! AXUIElement)
        }

        let cancelTitles = ["cancel", "no", "close", "dismiss"]
        return findButtonByTitle(in: element, titles: cancelTitles, depth: 0)
    }

    private static func findButtonByTitle(in element: AXUIElement, titles: [String], depth: Int) -> AXUIElement? {
        guard depth < 5 else { return nil }
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return nil }

        for child in children {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            if let role = roleRef as? String, role == "AXButton" {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXTitleAttribute as CFString, &titleRef)
                if let title = titleRef as? String {
                    if titles.contains(title.lowercased()) {
                        return child
                    }
                }
            }
            if let found = findButtonByTitle(in: child, titles: titles, depth: depth + 1) {
                return found
            }
        }
        return nil
    }

    private static func findTextField(in element: AXUIElement) -> AXUIElement? {
        return findElement(in: element, role: "AXTextField", depth: 0)
            ?? findElement(in: element, role: "AXTextArea", depth: 0)
            ?? findElement(in: element, role: "AXComboBox", depth: 0)
    }

    private static func findElement(in element: AXUIElement, role: String, depth: Int) -> AXUIElement? {
        guard depth < 8 else { return nil }
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return nil }

        for child in children {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            if let childRole = roleRef as? String, childRole == role {
                return child
            }
            if let found = findElement(in: child, role: role, depth: depth + 1) {
                return found
            }
        }
        return nil
    }
}
