import Foundation
import ApplicationServices
import AppKit

// MARK: - Read & Inspect

class Read {

    /// Read the value/text content of an element
    static func read(
        ref: String,
        attr: String?,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        if let attr = attr {
            // Read specific attribute
            var valueRef: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(element, attr as CFString, &valueRef)
            if result == .success {
                let value = convertAXValue(valueRef)
                return (["ok": true, "ref": ref, "attr": attr, "value": value as Any], nil)
            }
            return (["ok": true, "ref": ref, "attr": attr, "value": NSNull()], nil)
        }

        // Default: read value attribute
        var valueRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef)
        let value = valueRef as? String

        // Also get label
        var labelRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &labelRef)
        let label = labelRef as? String

        // Get role
        var roleRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef)
        let role = roleRef as? String

        return (["ok": true, "ref": ref, "value": value as Any, "label": label as Any, "role": role as Any], nil)
    }

    /// Get the title of the active window or frontmost app
    static func title(
        appMode: Bool,
        grabbedWindow: String?,
        windowManager: WindowManager
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        if appMode {
            // Return frontmost app name
            if let app = NSWorkspace.shared.frontmostApplication {
                return (["ok": true, "title": app.localizedName as Any, "bundle_id": app.bundleIdentifier as Any], nil)
            }
            return (["ok": true, "title": NSNull()], nil)
        }

        // Return window title
        if let ref = grabbedWindow, let info = windowManager.getWindowInfo(ref: ref) {
            return (["ok": true, "title": info["title"] as Any, "app": info["app"] as Any], nil)
        }

        // No grabbed window — try frontmost
        if let app = NSWorkspace.shared.frontmostApplication {
            let pid = app.processIdentifier
            let appElement = AXUIElementCreateApplication(pid)
            var windowRef: CFTypeRef?
            AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &windowRef)
            if let window = windowRef {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(window as! AXUIElement, kAXTitleAttribute as CFString, &titleRef)
                return (["ok": true, "title": (titleRef as? String) as Any, "app": app.localizedName as Any], nil)
            }
        }

        return (["ok": true, "title": NSNull()], nil)
    }

    /// Check element state: visible, enabled, focused, checked
    static func isState(
        state: String,
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        let value: Bool
        switch state {
        case "visible":
            // Element exists in AX tree, so it's "visible" in the accessibility sense
            // Check if it has non-zero bounds
            let bounds = getBounds(element)
            value = bounds[2] > 0 && bounds[3] > 0
        case "enabled":
            var enabledRef: CFTypeRef?
            AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabledRef)
            value = (enabledRef as? Bool) ?? true
        case "focused":
            var focusedRef: CFTypeRef?
            AXUIElementCopyAttributeValue(element, kAXFocusedAttribute as CFString, &focusedRef)
            value = (focusedRef as? Bool) ?? false
        case "checked":
            var valueRef: CFTypeRef?
            AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef)
            if let num = valueRef as? NSNumber {
                value = num.intValue == 1
            } else {
                value = false
            }
        default:
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Unknown state: \(state). Use: visible, enabled, focused, checked"))
        }

        return (["ok": true, "ref": ref, "state": state, "value": value], nil)
    }

    /// Get bounding box of an element
    static func box(
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        let bounds = getBounds(element)
        return (["ok": true, "ref": ref, "bounds": bounds], nil)
    }

    /// List direct children of an element
    static func children(
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)

        guard let axChildren = childrenRef as? [AXUIElement] else {
            return (["ok": true, "ref": ref, "children": [] as [Any], "count": 0], nil)
        }

        var childList: [[String: Any]] = []
        for child in axChildren {
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            let role = roleRef as? String ?? "unknown"

            var titleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXTitleAttribute as CFString, &titleRef)
            let title = titleRef as? String

            var valueRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXValueAttribute as CFString, &valueRef)
            let value = valueRef as? String

            childList.append([
                "role": normalizeRole(role),
                "label": title as Any,
                "value": value as Any,
            ])
        }

        return (["ok": true, "ref": ref, "children": childList, "count": childList.count], nil)
    }

    // MARK: - Helpers

    private static func getBounds(_ element: AXUIElement) -> [Double] {
        var positionRef: CFTypeRef?
        var sizeRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionRef)
        AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeRef)

        var point = CGPoint.zero
        var size = CGSize.zero
        if let positionRef = positionRef { AXValueGetValue(positionRef as! AXValue, .cgPoint, &point) }
        if let sizeRef = sizeRef { AXValueGetValue(sizeRef as! AXValue, .cgSize, &size) }
        return [Double(point.x), Double(point.y), Double(size.width), Double(size.height)]
    }

    private static func convertAXValue(_ ref: CFTypeRef?) -> Any {
        guard let ref = ref else { return NSNull() }
        if let str = ref as? String { return str }
        if let num = ref as? NSNumber { return num }
        if let bool = ref as? Bool { return bool }
        return String(describing: ref)
    }
}
