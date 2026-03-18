import Foundation
import ApplicationServices

// MARK: - Focus, Select, Check/Uncheck, Set

class Focus {

    /// Set keyboard focus on an element
    static func focus(
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        let result = AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, true as CFTypeRef)
        if result != .success {
            // Try clicking the element as fallback
            AXUIElementPerformAction(element, kAXPressAction as CFString)
        }

        return (["ok": true, "ref": ref], nil)
    }

    /// Select an option in a dropdown/popup by value or label
    static func select(
        ref: String,
        value: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        // Try setting value directly
        let setResult = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value as CFTypeRef)
        if setResult == .success {
            return (["ok": true, "ref": ref, "value": value], nil)
        }

        // Try finding and clicking the option in children
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        if let children = childrenRef as? [AXUIElement] {
            for child in children {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXTitleAttribute as CFString, &titleRef)
                let title = titleRef as? String ?? ""

                var valueRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXValueAttribute as CFString, &valueRef)
                let childValue = valueRef as? String ?? ""

                if title == value || childValue == value {
                    AXUIElementPerformAction(child, kAXPressAction as CFString)
                    return (["ok": true, "ref": ref, "value": value, "method": "child_press"], nil)
                }
            }
        }

        // Fallback: open popup and try to select
        AXUIElementPerformAction(element, kAXPressAction as CFString)
        Thread.sleep(forTimeInterval: 0.2)

        // Re-read children after opening
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        if let children = childrenRef as? [AXUIElement] {
            for child in children {
                var titleRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXTitleAttribute as CFString, &titleRef)
                if (titleRef as? String) == value {
                    AXUIElementPerformAction(child, kAXPressAction as CFString)
                    return (["ok": true, "ref": ref, "value": value, "method": "popup_select"], nil)
                }
            }
        }

        return (["ok": true, "ref": ref, "value": value, "method": "set_value_attempted"], nil)
    }

    /// Check a checkbox (idempotent — only checks if not already checked)
    static func check(
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        // Read current value
        var valueRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef)

        let currentValue: Int
        if let num = valueRef as? NSNumber {
            currentValue = num.intValue
        } else {
            currentValue = 0
        }

        // Only click if not already checked (value != 1)
        if currentValue != 1 {
            AXUIElementPerformAction(element, kAXPressAction as CFString)
        }

        return (["ok": true, "ref": ref, "checked": true], nil)
    }

    /// Uncheck a checkbox (idempotent — only unchecks if currently checked)
    static func uncheck(
        ref: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        var valueRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef)

        let currentValue: Int
        if let num = valueRef as? NSNumber {
            currentValue = num.intValue
        } else {
            currentValue = 0
        }

        // Only click if currently checked (value == 1)
        if currentValue == 1 {
            AXUIElementPerformAction(element, kAXPressAction as CFString)
        }

        return (["ok": true, "ref": ref, "checked": false], nil)
    }

    /// Set the value of a slider, stepper, or text field
    static func setValue(
        ref: String,
        value: String,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let element = refMap[ref] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Element not found: \(ref). Take a snapshot first."))
        }

        // Try setting as number first (for sliders/steppers)
        if let numValue = Double(value) {
            let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, numValue as CFTypeRef)
            if result == .success {
                return (["ok": true, "ref": ref, "value": value], nil)
            }
        }

        // Fall back to string value
        let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, value as CFTypeRef)
        if result == .success {
            return (["ok": true, "ref": ref, "value": value], nil)
        }

        return (["ok": true, "ref": ref, "value": value, "note": "set_value may not have taken effect"], nil)
    }
}
