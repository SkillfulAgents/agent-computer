import Foundation
import ApplicationServices

// MARK: - Human-Like Input Simulation

class HumanLike {

    /// Move the mouse along a curved path (Bezier curve) from current position to target
    static func curvedMouseMove(to target: CGPoint, duration: Double) {
        let start = CGEvent(source: nil)?.location ?? CGPoint.zero
        let steps = max(Int(duration / 0.01), 10)

        // Generate a control point for a quadratic Bezier curve
        // Offset perpendicular to the line, with some randomness
        let midX = (start.x + target.x) / 2.0
        let midY = (start.y + target.y) / 2.0
        let dx = target.x - start.x
        let dy = target.y - start.y
        let dist = sqrt(dx * dx + dy * dy)

        // Control point offset: perpendicular to direction, scaled by distance
        let offsetScale = CGFloat.random(in: 0.1...0.4) * dist
        let offsetSign: CGFloat = Bool.random() ? 1.0 : -1.0
        let controlX = midX + (-dy / dist) * offsetScale * offsetSign
        let controlY = midY + (dx / dist) * offsetScale * offsetSign

        let sleepInterval = duration / Double(steps)

        for i in 0...steps {
            let t = CGFloat(i) / CGFloat(steps)

            // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
            let oneMinusT = 1.0 - t
            let x = oneMinusT * oneMinusT * start.x + 2.0 * oneMinusT * t * controlX + t * t * target.x
            let y = oneMinusT * oneMinusT * start.y + 2.0 * oneMinusT * t * controlY + t * t * target.y

            let point = CGPoint(x: x, y: y)
            if let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                                        mouseCursorPosition: point, mouseButton: .left) {
                moveEvent.post(tap: .cghidEventTap)
            }

            // Variable sleep: slightly slower at start and end (ease in/out)
            let easeFactor = 1.0 + 0.5 * sin(Double.pi * Double(t))
            Thread.sleep(forTimeInterval: sleepInterval * easeFactor)
        }
    }

    /// Type text with variable inter-key delays (simulating human typing cadence)
    static func humanType(text: String, baseDelay: Int) {
        let baseMs = Double(baseDelay > 0 ? baseDelay : 50)

        for char in text {
            let charStr = String(char)

            // Variable delay: some characters take longer
            var delayMs = baseMs

            // Pause slightly longer after punctuation
            if ".!?,;:".contains(char) {
                delayMs *= Double.random(in: 1.5...3.0)
            }
            // Space is usually quick
            else if char == " " {
                delayMs *= Double.random(in: 0.6...1.0)
            }
            // Normal variation
            else {
                delayMs *= Double.random(in: 0.7...1.4)
            }

            Keyboard.pressKey(combo: charStr)
            Thread.sleep(forTimeInterval: delayMs / 1000.0)
        }
    }

    /// Click with a small random offset from center (humans don't click dead center)
    static func humanClick(element: AXUIElement, jitterPixels: Double = 3.0) {
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

        // Add jitter: random offset from center, clamped within element bounds
        let jitterX = CGFloat.random(in: -jitterPixels...jitterPixels)
        let jitterY = CGFloat.random(in: -jitterPixels...jitterPixels)
        let centerX = point.x + size.width / 2.0 + jitterX
        let centerY = point.y + size.height / 2.0 + jitterY

        // Clamp within element
        let clampedX = max(point.x + 2, min(centerX, point.x + size.width - 2))
        let clampedY = max(point.y + 2, min(centerY, point.y + size.height - 2))

        let clickPoint = CGPoint(x: clampedX, y: clampedY)

        // Small pre-click delay (human reaction time)
        Thread.sleep(forTimeInterval: Double.random(in: 0.02...0.08))

        // Click
        if let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown,
                                    mouseCursorPosition: clickPoint, mouseButton: .left),
           let upEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,
                                  mouseCursorPosition: clickPoint, mouseButton: .left) {
            downEvent.post(tap: .cghidEventTap)
            Thread.sleep(forTimeInterval: Double.random(in: 0.05...0.12))
            upEvent.post(tap: .cghidEventTap)
        }
    }

    /// Perform a human-like drag with curved path
    static func humanDrag(from: CGPoint, to: CGPoint, duration: Double) {
        let steps = max(Int(duration / 0.01), 20)

        // Bezier control point
        let midX = (from.x + to.x) / 2.0
        let midY = (from.y + to.y) / 2.0
        let dx = to.x - from.x
        let dy = to.y - from.y
        let dist = sqrt(dx * dx + dy * dy)
        let offsetScale = CGFloat.random(in: 0.05...0.2) * dist
        let offsetSign: CGFloat = Bool.random() ? 1.0 : -1.0
        let controlX = midX + (-dy / max(dist, 1)) * offsetScale * offsetSign
        let controlY = midY + (dx / max(dist, 1)) * offsetScale * offsetSign

        // Move to start
        curvedMouseMove(to: from, duration: 0.15)
        Thread.sleep(forTimeInterval: Double.random(in: 0.05...0.1))

        // Mouse down
        if let downEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown,
                                    mouseCursorPosition: from, mouseButton: .left) {
            downEvent.post(tap: .cghidEventTap)
        }
        Thread.sleep(forTimeInterval: Double.random(in: 0.03...0.08))

        let sleepInterval = duration / Double(steps)

        // Drag along curve
        for i in 1...steps {
            let t = CGFloat(i) / CGFloat(steps)
            let oneMinusT = 1.0 - t
            let x = oneMinusT * oneMinusT * from.x + 2.0 * oneMinusT * t * controlX + t * t * to.x
            let y = oneMinusT * oneMinusT * from.y + 2.0 * oneMinusT * t * controlY + t * t * to.y

            let point = CGPoint(x: x, y: y)
            if let dragEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged,
                                        mouseCursorPosition: point, mouseButton: .left) {
                dragEvent.post(tap: .cghidEventTap)
            }

            let easeFactor = 1.0 + 0.3 * sin(Double.pi * Double(t))
            Thread.sleep(forTimeInterval: sleepInterval * easeFactor)
        }

        // Mouse up
        Thread.sleep(forTimeInterval: Double.random(in: 0.02...0.06))
        if let upEvent = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp,
                                  mouseCursorPosition: to, mouseButton: .left) {
            upEvent.post(tap: .cghidEventTap)
        }
    }
}
