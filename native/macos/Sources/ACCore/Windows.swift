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
}
