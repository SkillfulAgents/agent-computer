import AppKit
import QuartzCore

// MARK: - Private CoreGraphics APIs for cross-process window z-ordering

@_silgen_name("CGSMainConnectionID")
private func CGSMainConnectionID() -> UInt32

@_silgen_name("CGSOrderWindow")
private func CGSOrderWindow(_ cid: UInt32, _ wid: UInt32, _ mode: Int32, _ relativeToWid: UInt32) -> Int32

private let kCGSOrderAbove: Int32 = 1

// MARK: - Animated Halo Overlay

/// Creates a transparent, click-through overlay window around a target window
/// with an animated glowing border to indicate agent control.
class HaloOverlay {
    private var overlayWindow: NSWindow?
    private var trackingTimer: DispatchSourceTimer?
    private var borderLayer: CAShapeLayer?
    private var glowLayer: CAShapeLayer?
    private let windowID: CGWindowID
    private var zOrderTickCount: Int = 0

    // Layout constants
    private let overlayMargin: CGFloat = 40   // extra space around window for glow + shadow
    private let borderGap: CGFloat = 5        // gap between window edge and halo border center
    private let borderWidth: CGFloat = 3.5
    private let glowWidth: CGFloat = 12.0
    private let cornerRadius: CGFloat = 12.0

    // Colors
    private let blueColor = NSColor(srgbRed: 0.29, green: 0.56, blue: 1.0, alpha: 1.0)
    private let purpleColor = NSColor(srgbRed: 0.56, green: 0.36, blue: 1.0, alpha: 1.0)

    init(windowID: CGWindowID) {
        self.windowID = windowID
        setup()
    }

    // MARK: - Setup

    private func setup() {
        guard let windowBounds = queryWindowBounds() else { return }

        let frame = calcOverlayFrame(from: windowBounds)

        // Transparent, click-through, always-on-top window
        let window = NSWindow(
            contentRect: frame,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        window.isOpaque = false
        window.backgroundColor = .clear
        window.level = .normal
        window.ignoresMouseEvents = true
        window.hasShadow = false
        window.collectionBehavior = [.canJoinAllSpaces, .stationary]

        let contentView = NSView(frame: NSRect(origin: .zero, size: frame.size))
        contentView.wantsLayer = true

        setupLayers(in: contentView)

        window.contentView = contentView
        window.orderFront(nil)
        overlayWindow = window

        // Place overlay directly above the target window in the z-stack
        orderAboveTarget()

        startTracking()
    }

    private func setupLayers(in view: NSView) {
        let pathInset = overlayMargin - borderGap
        let pathRect = view.bounds.insetBy(dx: pathInset, dy: pathInset)
        let path = CGPath(roundedRect: pathRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

        // --- Glow layer (behind border) ---
        let glow = CAShapeLayer()
        glow.path = path
        glow.fillColor = nil
        glow.strokeColor = blueColor.withAlphaComponent(0.3).cgColor
        glow.lineWidth = glowWidth
        glow.shadowColor = blueColor.cgColor
        glow.shadowRadius = 20
        glow.shadowOpacity = 0.9
        glow.shadowOffset = .zero
        view.layer?.addSublayer(glow)
        glowLayer = glow

        // Shadow radius pulse
        let shadowPulse = CABasicAnimation(keyPath: "shadowRadius")
        shadowPulse.fromValue = 12
        shadowPulse.toValue = 30
        shadowPulse.duration = 1.5
        shadowPulse.autoreverses = true
        shadowPulse.repeatCount = .infinity
        shadowPulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        glow.add(shadowPulse, forKey: "shadowPulse")

        // Glow opacity pulse
        let glowOpacity = CABasicAnimation(keyPath: "opacity")
        glowOpacity.fromValue = 0.5
        glowOpacity.toValue = 1.0
        glowOpacity.duration = 1.5
        glowOpacity.autoreverses = true
        glowOpacity.repeatCount = .infinity
        glowOpacity.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        glow.add(glowOpacity, forKey: "glowOpacity")

        // Glow color shift (blue → purple)
        let glowColorShift = CABasicAnimation(keyPath: "strokeColor")
        glowColorShift.fromValue = blueColor.withAlphaComponent(0.3).cgColor
        glowColorShift.toValue = purpleColor.withAlphaComponent(0.3).cgColor
        glowColorShift.duration = 3.0
        glowColorShift.autoreverses = true
        glowColorShift.repeatCount = .infinity
        glowColorShift.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        glow.add(glowColorShift, forKey: "glowColorShift")

        // Shadow color shift
        let shadowColorShift = CABasicAnimation(keyPath: "shadowColor")
        shadowColorShift.fromValue = blueColor.cgColor
        shadowColorShift.toValue = purpleColor.cgColor
        shadowColorShift.duration = 3.0
        shadowColorShift.autoreverses = true
        shadowColorShift.repeatCount = .infinity
        shadowColorShift.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        glow.add(shadowColorShift, forKey: "shadowColorShift")

        // --- Border layer ---
        let border = CAShapeLayer()
        border.path = path
        border.fillColor = nil
        border.strokeColor = blueColor.withAlphaComponent(0.9).cgColor
        border.lineWidth = borderWidth
        view.layer?.addSublayer(border)
        borderLayer = border

        // Border color shift (blue → purple)
        let borderColorShift = CABasicAnimation(keyPath: "strokeColor")
        borderColorShift.fromValue = blueColor.withAlphaComponent(0.9).cgColor
        borderColorShift.toValue = purpleColor.withAlphaComponent(0.9).cgColor
        borderColorShift.duration = 3.0
        borderColorShift.autoreverses = true
        borderColorShift.repeatCount = .infinity
        borderColorShift.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        border.add(borderColorShift, forKey: "borderColorShift")

        // Border opacity pulse
        let borderPulse = CABasicAnimation(keyPath: "opacity")
        borderPulse.fromValue = 0.6
        borderPulse.toValue = 1.0
        borderPulse.duration = 1.5
        borderPulse.autoreverses = true
        borderPulse.repeatCount = .infinity
        borderPulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        border.add(borderPulse, forKey: "borderPulse")
    }

    // MARK: - Geometry

    private func calcOverlayFrame(from windowBounds: CGRect) -> NSRect {
        let screenHeight = NSScreen.main?.frame.height ?? 0
        let x = windowBounds.origin.x - overlayMargin
        let cgY = windowBounds.origin.y - overlayMargin
        let w = windowBounds.width + overlayMargin * 2
        let h = windowBounds.height + overlayMargin * 2
        // Convert from CG coords (top-left origin) to AppKit coords (bottom-left origin)
        let appKitY = screenHeight - cgY - h
        return NSRect(x: x, y: appKitY, width: w, height: h)
    }

    private func queryWindowBounds() -> CGRect? {
        guard let list = CGWindowListCopyWindowInfo([.optionIncludingWindow], windowID) as? [[String: Any]],
              let info = list.first,
              let bounds = info[kCGWindowBounds as String] as? [String: Any] else {
            return nil
        }
        let x = bounds["X"] as? CGFloat ?? 0
        let y = bounds["Y"] as? CGFloat ?? 0
        let w = bounds["Width"] as? CGFloat ?? 0
        let h = bounds["Height"] as? CGFloat ?? 0
        return CGRect(x: x, y: y, width: w, height: h)
    }

    // MARK: - Z-Order

    /// Place the overlay directly above the target window in the global z-stack,
    /// so windows above the target also appear above the overlay.
    private func orderAboveTarget() {
        guard let window = overlayWindow else { return }
        // Bring to front first — this breaks stale z-position so CGSOrderWindow
        // doesn't treat the subsequent call as a no-op.
        window.orderFront(nil)
        let cid = CGSMainConnectionID()
        let overlayWID = UInt32(window.windowNumber)
        _ = CGSOrderWindow(cid, overlayWID, kCGSOrderAbove, windowID)
    }

    // MARK: - Position Tracking

    private func startTracking() {
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + 0.016, repeating: 0.016)  // ~60fps
        timer.setEventHandler { [weak self] in
            self?.trackingTick()
        }
        timer.resume()
        trackingTimer = timer
    }

    private func trackingTick() {
        guard let windowBounds = queryWindowBounds(), let window = overlayWindow else {
            // Window was closed — hide overlay
            overlayWindow?.orderOut(nil)
            return
        }

        // Z-order maintenance at lower frequency (~5Hz) to avoid overhead
        zOrderTickCount += 1
        if zOrderTickCount % 12 == 0 {
            orderAboveTarget()
        }

        // Position tracking at full framerate
        let newFrame = calcOverlayFrame(from: windowBounds)

        guard !window.frame.equalTo(newFrame) else { return }

        window.setFrame(newFrame, display: false)

        // Update layer paths to match new size
        if let contentView = window.contentView {
            let viewBounds = NSRect(origin: .zero, size: newFrame.size)
            contentView.frame = viewBounds
            let pathInset = overlayMargin - borderGap
            let pathRect = viewBounds.insetBy(dx: pathInset, dy: pathInset)
            let path = CGPath(roundedRect: pathRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

            CATransaction.begin()
            CATransaction.setDisableActions(true)
            borderLayer?.path = path
            glowLayer?.path = path
            CATransaction.commit()
        }
    }

    // MARK: - Cleanup

    func remove() {
        trackingTimer?.cancel()
        trackingTimer = nil
        overlayWindow?.orderOut(nil)
        overlayWindow = nil
        borderLayer = nil
        glowLayer = nil
    }
}
