import Foundation
import ApplicationServices

// MARK: - Drag & Drop

class Drag {

    /// Perform a drag from one point/ref to another
    static func drag(
        fromRef: String?,
        fromX: Double?,
        fromY: Double?,
        toRef: String?,
        toX: Double?,
        toY: Double?,
        duration: Double,
        steps: Int,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // Resolve from point
        let fromPoint: CGPoint
        if let ref = fromRef {
            guard let element = refMap[ref] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "From element not found: \(ref). Take a snapshot first."))
            }
            fromPoint = centerOf(element)
        } else if let x = fromX, let y = fromY {
            fromPoint = CGPoint(x: x, y: y)
        } else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Missing from position: provide from_ref or from_x/from_y"))
        }

        // Resolve to point
        let toPoint: CGPoint
        if let ref = toRef {
            guard let element = refMap[ref] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "To element not found: \(ref). Take a snapshot first."))
            }
            toPoint = centerOf(element)
        } else if let x = toX, let y = toY {
            toPoint = CGPoint(x: x, y: y)
        } else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Missing to position: provide to_ref or to_x/to_y"))
        }

        // Perform the drag sequence
        performDrag(from: fromPoint, to: toPoint, duration: duration, steps: steps)

        return ([
            "ok": true,
            "from": ["x": Double(fromPoint.x), "y": Double(fromPoint.y)],
            "to": ["x": Double(toPoint.x), "y": Double(toPoint.y)]
        ] as [String: Any], nil)
    }

    // MARK: - Internal

    private static func performDrag(from: CGPoint, to: CGPoint, duration: Double, steps: Int) {
        let stepCount = max(steps, 2)
        let sleepInterval = duration / Double(stepCount)

        // Move to start position
        if let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                                    mouseCursorPosition: from, mouseButton: .left) {
            moveEvent.post(tap: .cghidEventTap)
        }
        Thread.sleep(forTimeInterval: 0.05)

        // Mouse down at start
        if let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown,
                                    mouseCursorPosition: from, mouseButton: .left) {
            downEvent.post(tap: .cghidEventTap)
        }
        Thread.sleep(forTimeInterval: 0.05)

        // Drag through intermediate points
        for i in 1...stepCount {
            let t = Double(i) / Double(stepCount)
            let x = from.x + (to.x - from.x) * CGFloat(t)
            let y = from.y + (to.y - from.y) * CGFloat(t)
            let point = CGPoint(x: x, y: y)

            if let dragEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged,
                                        mouseCursorPosition: point, mouseButton: .left) {
                dragEvent.post(tap: .cghidEventTap)
            }
            Thread.sleep(forTimeInterval: sleepInterval)
        }

        // Mouse up at end
        if let upEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,
                                  mouseCursorPosition: to, mouseButton: .left) {
            upEvent.post(tap: .cghidEventTap)
        }
    }

    private static func centerOf(_ element: AXUIElement) -> CGPoint {
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

        return CGPoint(x: point.x + size.width / 2.0, y: point.y + size.height / 2.0)
    }
}
