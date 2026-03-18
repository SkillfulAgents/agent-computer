import Foundation
import ApplicationServices

// MARK: - Click & Mouse Actions

class Actions {

    /// Perform a click action on an element by ref or at coordinates
    static func click(
        ref: String?,
        x: Double?,
        y: Double?,
        right: Bool,
        double: Bool,
        count: Int,
        modifiers: [String],
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        var clickPoint: CGPoint = .zero
        var bounds: [Double] = [0, 0, 0, 0]

        if let ref = ref {
            // Resolve ref to AXUIElement
            guard let element = refMap[ref] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "Element not found: \(ref). Take a snapshot first."))
            }

            bounds = getBounds(element)

            // For simple left-clicks without modifiers, use AXPerformAction (most reliable)
            if !right && modifiers.isEmpty {
                let totalClicks = double ? 2 : count
                for _ in 1...totalClicks {
                    let axResult = AXUIElementPerformAction(element, kAXPressAction as CFString)
                    if axResult != .success {
                        // Fall back to CGEvent click
                        let centerX = bounds[0] + bounds[2] / 2.0
                        let centerY = bounds[1] + bounds[3] / 2.0
                        performCGClick(at: CGPoint(x: centerX, y: centerY), right: false,
                                       clickNum: 1, modifiers: [])
                    }
                    if totalClicks > 1 {
                        Thread.sleep(forTimeInterval: 0.05)
                    }
                }
            } else {
                // Right-click, modifier clicks, etc. use CGEvent (AX doesn't support these)
                let centerX = bounds[0] + bounds[2] / 2.0
                let centerY = bounds[1] + bounds[3] / 2.0
                clickPoint = CGPoint(x: centerX, y: centerY)
                let totalClicks = double ? 2 : count
                for clickNum in 1...totalClicks {
                    performCGClick(at: clickPoint, right: right,
                                   clickNum: clickNum, modifiers: modifiers)
                    if clickNum < totalClicks {
                        Thread.sleep(forTimeInterval: 0.05)
                    }
                }
            }

            let result: [String: Any] = ["ok": true, "ref": ref, "bounds": bounds]
            return (result, nil)

        } else if let x = x, let y = y {
            clickPoint = CGPoint(x: x, y: y)
            let totalClicks = double ? 2 : count
            for clickNum in 1...totalClicks {
                performCGClick(at: clickPoint, right: right,
                               clickNum: clickNum, modifiers: modifiers)
                if clickNum < totalClicks {
                    Thread.sleep(forTimeInterval: 0.05)
                }
            }
            return (["ok": true], nil)

        } else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Either ref or x,y coordinates required"))
        }
    }

    /// Move the mouse cursor to a position (hover, no click)
    static func hover(
        ref: String?,
        x: Double?,
        y: Double?,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        let point: CGPoint
        var bounds: [Double] = [0, 0, 0, 0]
        var resolvedRef: String? = ref

        if let ref = ref {
            guard let element = refMap[ref] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "Element not found: \(ref). Take a snapshot first."))
            }
            bounds = getBounds(element)
            let centerX = bounds[0] + bounds[2] / 2.0
            let centerY = bounds[1] + bounds[3] / 2.0
            point = CGPoint(x: centerX, y: centerY)
        } else if let x = x, let y = y {
            point = CGPoint(x: x, y: y)
            resolvedRef = nil
        } else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Either ref or x,y coordinates required"))
        }

        guard let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                                      mouseCursorPosition: point, mouseButton: .left) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to create mouse move event"))
        }
        moveEvent.post(tap: .cghidEventTap)

        var result: [String: Any] = ["ok": true]
        if let resolvedRef = resolvedRef {
            result["ref"] = resolvedRef
            result["bounds"] = bounds
        }
        return (result, nil)
    }

    /// Press or release a mouse button
    static func mouseButton(
        action: String, // "down" or "up"
        button: String  // "left", "right", or "middle"
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // Get current mouse position
        let currentPos = CGEvent(source: nil)?.location ?? CGPoint.zero

        let mouseButton: CGMouseButton
        let eventType: CGEventType

        switch button {
        case "right":
            mouseButton = .right
            eventType = action == "down" ? .rightMouseDown : .rightMouseUp
        case "middle":
            mouseButton = .center
            eventType = action == "down" ? .otherMouseDown : .otherMouseUp
        default: // "left"
            mouseButton = .left
            eventType = action == "down" ? .leftMouseDown : .leftMouseUp
        }

        guard let event = CGEvent(mouseEventSource: nil, mouseType: eventType,
                                  mouseCursorPosition: currentPos, mouseButton: mouseButton) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to create mouse event"))
        }
        event.post(tap: .cghidEventTap)

        return (["ok": true, "button": button, "action": action], nil)
    }

    // MARK: - Helpers

    private static func performCGClick(at point: CGPoint, right: Bool, clickNum: Int, modifiers: [String]) {
        let button: CGMouseButton = right ? .right : .left
        let downType: CGEventType = right ? .rightMouseDown : .leftMouseDown
        let upType: CGEventType = right ? .rightMouseUp : .leftMouseUp

        guard let downEvent = CGEvent(mouseEventSource: nil, mouseType: downType,
                                      mouseCursorPosition: point, mouseButton: button),
              let upEvent = CGEvent(mouseEventSource: nil, mouseType: upType,
                                    mouseCursorPosition: point, mouseButton: button) else {
            return
        }

        downEvent.setIntegerValueField(.mouseEventClickState, value: Int64(clickNum))
        upEvent.setIntegerValueField(.mouseEventClickState, value: Int64(clickNum))

        let modifierFlags = buildModifierFlags(modifiers)
        if modifierFlags != [] {
            downEvent.flags = modifierFlags
            upEvent.flags = modifierFlags
        }

        downEvent.post(tap: .cghidEventTap)
        upEvent.post(tap: .cghidEventTap)
    }

    private static func buildModifierFlags(_ modifiers: [String]) -> CGEventFlags {
        var flags = CGEventFlags()
        for mod in modifiers {
            switch mod.lowercased() {
            case "cmd", "command":
                flags.insert(.maskCommand)
            case "shift":
                flags.insert(.maskShift)
            case "opt", "option", "alt":
                flags.insert(.maskAlternate)
            case "ctrl", "control":
                flags.insert(.maskControl)
            case "fn":
                flags.insert(.maskSecondaryFn)
            default:
                break
            }
        }
        return flags
    }

    private static func getBounds(_ element: AXUIElement) -> [Double] {
        var positionRef: CFTypeRef?
        var sizeRef: CFTypeRef?

        AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionRef)
        AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeRef)

        var point = CGPoint.zero
        var size = CGSize.zero

        if let positionRef = positionRef {
            AXValueGetValue(positionRef as! AXValue, .cgPoint, &point)
        }
        if let sizeRef = sizeRef {
            AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)
        }

        return [Double(point.x), Double(point.y), Double(size.width), Double(size.height)]
    }
}
