import Foundation
import ApplicationServices

// MARK: - Scroll Actions

class Scroll {

    /// Scroll in a direction by a given amount
    static func scroll(
        direction: String,
        amount: Int,
        onRef: String?,
        pixels: Int?,
        smooth: Bool,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // If scrolling on a specific element, move mouse to its center first
        if let onRef = onRef {
            guard let element = refMap[onRef] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "Element not found: \(onRef). Take a snapshot first."))
            }
            let bounds = getBounds(element)
            let centerX = bounds[0] + bounds[2] / 2.0
            let centerY = bounds[1] + bounds[3] / 2.0

            // Move mouse to element center
            if let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                                       mouseCursorPosition: CGPoint(x: centerX, y: centerY), mouseButton: .left) {
                moveEvent.post(tap: .cghidEventTap)
                Thread.sleep(forTimeInterval: 0.05)
            }
        }

        let scrollAmount = pixels ?? (amount * 10) // Convert ticks to pixels if needed

        if smooth {
            performSmoothScroll(direction: direction, totalPixels: scrollAmount)
        } else {
            performDiscreteScroll(direction: direction, amount: amount, pixels: pixels)
        }

        return (["ok": true, "direction": direction, "amount": amount], nil)
    }

    // MARK: - Scroll Implementation

    private static func performDiscreteScroll(direction: String, amount: Int, pixels: Int?) {
        // CGEvent scroll uses wheel ticks (positive = up/left, negative = down/right)
        let deltaY: Int32
        let deltaX: Int32

        if let pixels = pixels {
            // Pixel-based scrolling
            switch direction {
            case "up": deltaY = Int32(pixels); deltaX = 0
            case "down": deltaY = -Int32(pixels); deltaX = 0
            case "left": deltaY = 0; deltaX = Int32(pixels)
            case "right": deltaY = 0; deltaX = -Int32(pixels)
            default: deltaY = 0; deltaX = 0
            }

            if let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel,
                                   wheelCount: 2, wheel1: deltaY, wheel2: deltaX, wheel3: 0) {
                event.post(tap: .cghidEventTap)
            }
        } else {
            // Tick-based scrolling (standard scroll wheel increments)
            switch direction {
            case "up": deltaY = Int32(amount); deltaX = 0
            case "down": deltaY = -Int32(amount); deltaX = 0
            case "left": deltaY = 0; deltaX = Int32(amount)
            case "right": deltaY = 0; deltaX = -Int32(amount)
            default: deltaY = 0; deltaX = 0
            }

            if let event = CGEvent(scrollWheelEvent2Source: nil, units: .line,
                                   wheelCount: 2, wheel1: deltaY, wheel2: deltaX, wheel3: 0) {
                event.post(tap: .cghidEventTap)
            }
        }
    }

    private static func performSmoothScroll(direction: String, totalPixels: Int) {
        // Smooth scrolling: break into small increments with delays
        let steps = min(totalPixels, 20)
        let pixelsPerStep = max(totalPixels / steps, 1)

        for _ in 0..<steps {
            let deltaY: Int32
            let deltaX: Int32

            switch direction {
            case "up": deltaY = Int32(pixelsPerStep); deltaX = 0
            case "down": deltaY = -Int32(pixelsPerStep); deltaX = 0
            case "left": deltaY = 0; deltaX = Int32(pixelsPerStep)
            case "right": deltaY = 0; deltaX = -Int32(pixelsPerStep)
            default: deltaY = 0; deltaX = 0
            }

            if let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel,
                                   wheelCount: 2, wheel1: deltaY, wheel2: deltaX, wheel3: 0) {
                event.post(tap: .cghidEventTap)
            }
            Thread.sleep(forTimeInterval: 0.02) // 20ms between steps
        }
    }

    // MARK: - Helpers

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
