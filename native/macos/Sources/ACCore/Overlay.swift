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
///
/// Z-ordering strategy: `orderFront` in setup places the overlay at the top of
/// the stack.  CGSOrderWindow then moves it *down* to just above the target
/// (cross-process downward moves work; upward moves do not).  `orderFront` is
/// only called again if the overlay drops off the screen (e.g. after Exposé).
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

        // Transparent, click-through overlay window
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
        window.collectionBehavior = [.stationary]

        let contentView = NSView(frame: NSRect(origin: .zero, size: frame.size))
        contentView.wantsLayer = true

        setupLayers(in: contentView)

        window.contentView = contentView
        window.orderFront(nil)
        overlayWindow = window

        // Move the overlay down from the top to just above the target
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

    /// Check whether the overlay is above the target in the on-screen z-stack.
    /// The CGWindowList is ordered front-to-back, so the overlay must appear at
    /// a *lower* index than the target.  Returns false when the overlay is below
    /// the target or not in the list at all (off-screen / after Exposé).
    private func isOverlayAboveTarget() -> Bool {
        guard let window = overlayWindow else { return false }
        let overlayNum = CGWindowID(window.windowNumber)
        guard let list = CGWindowListCopyWindowInfo(
            [.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID
        ) as? [[String: Any]] else {
            return false
        }
        for w in list {
            let wid = w[kCGWindowNumber as String] as? CGWindowID ?? 0
            if wid == overlayNum { return true }  // overlay comes first → above target
            if wid == windowID   { return false } // target comes first → overlay is below
        }
        return false // overlay not found on screen
    }

    /// Position the overlay directly above the target in the z-stack.
    /// CGSOrderWindow can move a window *down* (from above) but not *up*.
    /// So when we detect the overlay has fallen below the target (after Exposé,
    /// dock-click refocus, etc.) we call orderFront to put it back at the top,
    /// then CGSOrderWindow moves it down to just above the target.
    private func orderAboveTarget() {
        guard let window = overlayWindow else { return }

        if !isOverlayAboveTarget() {
            window.orderFront(nil)
        }

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

    // MARK: - Ripple Animation

    /// Show a ripple animation at a screen point (CG coordinates, top-left origin).
    func showRipple(at screenPoint: CGPoint) {
        guard let window = overlayWindow, let contentView = window.contentView?.layer else { return }

        let screenHeight = NSScreen.main?.frame.height ?? 0
        let appKitY = screenHeight - screenPoint.y
        let localX = screenPoint.x - window.frame.origin.x
        let localY = appKitY - window.frame.origin.y

        let maxRadius: CGFloat = 90
        let ringPath = CGPath(
            ellipseIn: CGRect(x: -maxRadius, y: -maxRadius, width: maxRadius * 2, height: maxRadius * 2),
            transform: nil
        )

        // Outer ring — expands and fades
        let ring = CAShapeLayer()
        ring.path = ringPath
        ring.fillColor = blueColor.withAlphaComponent(0.25).cgColor
        ring.strokeColor = blueColor.withAlphaComponent(0.9).cgColor
        ring.lineWidth = 3.5
        ring.position = CGPoint(x: localX, y: localY)
        ring.transform = CATransform3DMakeScale(0.05, 0.05, 1)
        ring.opacity = 0
        ring.shadowColor = blueColor.cgColor
        ring.shadowRadius = 15
        ring.shadowOpacity = 0.8
        ring.shadowOffset = .zero
        contentView.addSublayer(ring)

        // Middle ring — slightly delayed
        let middle = CAShapeLayer()
        middle.path = ringPath
        middle.fillColor = blueColor.withAlphaComponent(0.1).cgColor
        middle.strokeColor = purpleColor.withAlphaComponent(0.7).cgColor
        middle.lineWidth = 2.5
        middle.position = CGPoint(x: localX, y: localY)
        middle.transform = CATransform3DMakeScale(0.05, 0.05, 1)
        middle.opacity = 0
        middle.shadowColor = purpleColor.cgColor
        middle.shadowRadius = 10
        middle.shadowOpacity = 0.6
        middle.shadowOffset = .zero
        contentView.addSublayer(middle)

        // Inner ring — most delayed, smallest
        let inner = CAShapeLayer()
        inner.path = ringPath
        inner.fillColor = nil
        inner.strokeColor = NSColor.white.withAlphaComponent(0.6).cgColor
        inner.lineWidth = 1.5
        inner.position = CGPoint(x: localX, y: localY)
        inner.transform = CATransform3DMakeScale(0.05, 0.05, 1)
        inner.opacity = 0
        contentView.addSublayer(inner)

        let duration: CFTimeInterval = 0.65

        // --- Outer ring animations ---
        let outerScale = CABasicAnimation(keyPath: "transform.scale")
        outerScale.fromValue = 0.05
        outerScale.toValue = 1.0

        let outerOpacity = CAKeyframeAnimation(keyPath: "opacity")
        outerOpacity.values = [1.0, 0.7, 0.0]
        outerOpacity.keyTimes = [0.0, 0.35, 1.0]

        let outerGroup = CAAnimationGroup()
        outerGroup.animations = [outerScale, outerOpacity]
        outerGroup.duration = duration
        outerGroup.timingFunction = CAMediaTimingFunction(name: .easeOut)
        outerGroup.fillMode = .forwards
        outerGroup.isRemovedOnCompletion = false

        // --- Middle ring animations ---
        let midScale = CABasicAnimation(keyPath: "transform.scale")
        midScale.fromValue = 0.05
        midScale.toValue = 0.75

        let midOpacity = CAKeyframeAnimation(keyPath: "opacity")
        midOpacity.values = [0.0, 0.9, 0.0]
        midOpacity.keyTimes = [0.0, 0.3, 1.0]

        let midGroup = CAAnimationGroup()
        midGroup.animations = [midScale, midOpacity]
        midGroup.duration = duration * 0.8
        midGroup.beginTime = CACurrentMediaTime() + 0.06
        midGroup.timingFunction = CAMediaTimingFunction(name: .easeOut)
        midGroup.fillMode = .forwards
        midGroup.isRemovedOnCompletion = false

        // --- Inner ring animations ---
        let innerScale = CABasicAnimation(keyPath: "transform.scale")
        innerScale.fromValue = 0.05
        innerScale.toValue = 0.5

        let innerOpacity = CAKeyframeAnimation(keyPath: "opacity")
        innerOpacity.values = [0.0, 0.8, 0.0]
        innerOpacity.keyTimes = [0.0, 0.25, 1.0]

        let innerGroup = CAAnimationGroup()
        innerGroup.animations = [innerScale, innerOpacity]
        innerGroup.duration = duration * 0.6
        innerGroup.beginTime = CACurrentMediaTime() + 0.12
        innerGroup.timingFunction = CAMediaTimingFunction(name: .easeOut)
        innerGroup.fillMode = .forwards
        innerGroup.isRemovedOnCompletion = false

        CATransaction.begin()
        CATransaction.setCompletionBlock {
            ring.removeFromSuperlayer()
            middle.removeFromSuperlayer()
            inner.removeFromSuperlayer()
        }
        ring.add(outerGroup, forKey: "ripple")
        middle.add(midGroup, forKey: "ripple")
        inner.add(innerGroup, forKey: "ripple")
        CATransaction.commit()
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
