import Foundation
import AppKit
import CoreGraphics

class WindowManager {
    private var windowRefs: [String: CGWindowID] = [:]  // "@w1" -> windowID
    private var windowInfoCache: [String: [String: Any]] = [:]
    private var nextWindowId = 1

    /// List all visible windows
    func listWindows(appName: String? = nil) -> [[String: Any]] {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
            return []
        }

        windowRefs = [:]
        windowInfoCache = [:]
        nextWindowId = 1

        var results: [[String: Any]] = []

        for windowInfo in windowList {
            guard let ownerName = windowInfo[kCGWindowOwnerName as String] as? String,
                  let windowID = windowInfo[kCGWindowNumber as String] as? CGWindowID,
                  let bounds = windowInfo[kCGWindowBounds as String] as? [String: Any],
                  let layer = windowInfo[kCGWindowLayer as String] as? Int,
                  layer == 0 // Normal window layer
            else {
                continue
            }

            // Filter by app name if specified
            if let filter = appName, ownerName.lowercased() != filter.lowercased() {
                continue
            }

            let title = windowInfo[kCGWindowName as String] as? String ?? ""
            let ownerPID = windowInfo[kCGWindowOwnerPID as String] as? Int ?? 0
            let isOnScreen = windowInfo[kCGWindowIsOnscreen as String] as? Bool ?? true

            let x = bounds["X"] as? Double ?? 0
            let y = bounds["Y"] as? Double ?? 0
            let w = bounds["Width"] as? Double ?? 0
            let h = bounds["Height"] as? Double ?? 0

            // Skip tiny windows (toolbar panels, etc.)
            if w < 50 || h < 50 {
                continue
            }

            let ref = "@w\(nextWindowId)"
            nextWindowId += 1

            windowRefs[ref] = windowID

            // Check minimized/hidden state via NSRunningApplication
            let runningApp = NSWorkspace.shared.runningApplications.first {
                $0.processIdentifier == pid_t(ownerPID)
            }
            let isHidden = runningApp?.isHidden ?? false

            // Detect minimized via bounds — minimized windows still appear in the list
            // but typically have off-screen coordinates or we check via AX later
            let isMinimized = !isOnScreen

            let info: [String: Any] = [
                "ref": ref,
                "title": title,
                "app": ownerName,
                "bundle_id": runningApp?.bundleIdentifier ?? "",
                "process_id": ownerPID,
                "bounds": [x, y, w, h],
                "minimized": isMinimized,
                "hidden": isHidden,
                "fullscreen": false, // Will be set via AX in later phases
            ]

            windowInfoCache[ref] = info
            results.append(info)
        }

        return results
    }

    /// Get window info by ref
    func getWindowInfo(ref: String) -> [String: Any]? {
        return windowInfoCache[ref]
    }

    /// Get CGWindowID for a ref
    func getWindowID(ref: String) -> CGWindowID? {
        return windowRefs[ref]
    }

    /// Get window ref for an app (first window)
    func getWindowRefForApp(appName: String) -> String? {
        // Refresh list
        let windows = listWindows(appName: appName)
        return windows.first?["ref"] as? String
    }

    /// Get PID for a window ref
    func getPID(ref: String) -> pid_t? {
        guard let info = windowInfoCache[ref],
              let pid = info["process_id"] as? Int else {
            return nil
        }
        return pid_t(pid)
    }

    // MARK: - AX Window Element Resolution

    /// Get the AXUIElement for a window ref
    func getAXWindow(ref: String) -> AXUIElement? {
        guard let pid = getPID(ref: ref) else { return nil }
        let appElement = AXUIElementCreateApplication(pid)

        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard result == .success, let axWindows = windowsRef as? [AXUIElement] else { return nil }

        // Match by title if possible
        let expectedTitle = windowInfoCache[ref]?["title"] as? String ?? ""
        for win in axWindows {
            var titleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(win, kAXTitleAttribute as CFString, &titleRef)
            let title = titleRef as? String ?? ""
            if title == expectedTitle { return win }
        }

        // Fallback: return first window
        return axWindows.first
    }

    // MARK: - Window Actions

    /// Minimize a window
    func minimize(ref: String) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        AXUIElementSetAttributeValue(axWindow, kAXMinimizedAttribute as CFString, true as CFTypeRef)
        return (["ok": true, "ref": ref], nil)
    }

    /// Maximize / zoom a window
    func maximize(ref: String) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        // Use AXZoomButton to toggle zoom (maximize)
        var zoomButtonRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(axWindow, kAXZoomButtonAttribute as CFString, &zoomButtonRef)
        if result == .success, let zoomButton = zoomButtonRef {
            AXUIElementPerformAction(zoomButton as! AXUIElement, kAXPressAction as CFString)
        }
        return (["ok": true, "ref": ref], nil)
    }

    /// Toggle fullscreen on a window
    func fullscreen(ref: String) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        // Toggle AXFullScreen attribute
        var fullscreenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(axWindow, "AXFullScreen" as CFString, &fullscreenRef)
        let currentFullscreen = fullscreenRef as? Bool ?? false
        AXUIElementSetAttributeValue(axWindow, "AXFullScreen" as CFString, (!currentFullscreen) as CFTypeRef)
        return (["ok": true, "ref": ref, "fullscreen": !currentFullscreen], nil)
    }

    /// Close a window
    func close(ref: String) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        var closeButtonRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(axWindow, kAXCloseButtonAttribute as CFString, &closeButtonRef)
        if result == .success, let closeButton = closeButtonRef {
            AXUIElementPerformAction(closeButton as! AXUIElement, kAXPressAction as CFString)
        }
        return (["ok": true, "ref": ref], nil)
    }

    /// Raise a window (bring to front and focus)
    func raise(ref: String) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }

        // Unminimize if minimized
        var minimizedRef: CFTypeRef?
        AXUIElementCopyAttributeValue(axWindow, kAXMinimizedAttribute as CFString, &minimizedRef)
        if minimizedRef as? Bool == true {
            AXUIElementSetAttributeValue(axWindow, kAXMinimizedAttribute as CFString, false as CFTypeRef)
        }

        // Raise the window
        AXUIElementPerformAction(axWindow, kAXRaiseAction as CFString)

        // Activate the owning app
        if let pid = getPID(ref: ref) {
            if let app = NSWorkspace.shared.runningApplications.first(where: { $0.processIdentifier == pid }) {
                app.activate(options: .activateIgnoringOtherApps)
            }
        }

        return (["ok": true, "ref": ref], nil)
    }

    /// Move a window to given coordinates
    func move(ref: String, x: Double, y: Double) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        var point = CGPoint(x: x, y: y)
        guard let posValue = AXValueCreate(.cgPoint, &point) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to create position value"))
        }
        AXUIElementSetAttributeValue(axWindow, kAXPositionAttribute as CFString, posValue)
        return (["ok": true, "ref": ref, "position": [x, y]], nil)
    }

    /// Resize a window
    func resize(ref: String, width: Double, height: Double) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        var size = CGSize(width: width, height: height)
        guard let sizeValue = AXValueCreate(.cgSize, &size) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to create size value"))
        }
        AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue)
        return (["ok": true, "ref": ref, "size": [width, height]], nil)
    }

    /// Set window bounds (position + size)
    func setBounds(ref: String, x: Double, y: Double, width: Double, height: Double) -> (result: [String: Any]?, error: RPCResponse?) {
        guard let axWindow = getAXWindow(ref: ref) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "Window not found: \(ref)"))
        }
        var point = CGPoint(x: x, y: y)
        var size = CGSize(width: width, height: height)
        if let posValue = AXValueCreate(.cgPoint, &point) {
            AXUIElementSetAttributeValue(axWindow, kAXPositionAttribute as CFString, posValue)
        }
        if let sizeValue = AXValueCreate(.cgSize, &size) {
            AXUIElementSetAttributeValue(axWindow, kAXSizeAttribute as CFString, sizeValue)
        }
        return (["ok": true, "ref": ref, "bounds": [x, y, width, height]], nil)
    }

    /// Apply a preset bounds layout
    func applyPreset(ref: String, preset: String) -> (result: [String: Any]?, error: RPCResponse?) {
        // Get main screen dimensions
        guard let screen = NSScreen.main else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "No main screen found"))
        }

        let frame = screen.visibleFrame
        let screenX = Double(frame.origin.x)
        // Convert from bottom-left (AppKit) to top-left (screen coords)
        let screenY = Double(NSScreen.main!.frame.height - frame.origin.y - frame.height)
        let screenW = Double(frame.width)
        let screenH = Double(frame.height)

        let x: Double, y: Double, w: Double, h: Double

        switch preset {
        case "left-half":
            x = screenX; y = screenY; w = screenW / 2; h = screenH
        case "right-half":
            x = screenX + screenW / 2; y = screenY; w = screenW / 2; h = screenH
        case "top-half":
            x = screenX; y = screenY; w = screenW; h = screenH / 2
        case "bottom-half":
            x = screenX; y = screenY + screenH / 2; w = screenW; h = screenH / 2
        case "center":
            let centerW = screenW * 0.6
            let centerH = screenH * 0.6
            x = screenX + (screenW - centerW) / 2
            y = screenY + (screenH - centerH) / 2
            w = centerW; h = centerH
        case "fill":
            x = screenX; y = screenY; w = screenW; h = screenH
        default:
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Unknown preset: \(preset). Use: left-half, right-half, top-half, bottom-half, center, fill"))
        }

        return setBounds(ref: ref, x: x, y: y, width: w, height: h)
    }
}
