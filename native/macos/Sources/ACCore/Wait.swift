import Foundation
import ApplicationServices
import AppKit

// MARK: - Wait & Poll

class Wait {

    /// Wait for a fixed duration
    static func waitMs(ms: Int) -> [String: Any] {
        Thread.sleep(forTimeInterval: Double(ms) / 1000.0)
        return ["ok": true, "waited_ms": ms]
    }

    /// Wait for an element to exist/be visible, or disappear
    static func waitForElement(
        ref: String,
        hidden: Bool,
        enabled: Bool,
        timeout: Int,
        refMap: [String: AXUIElement]
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        let deadline = Date().addingTimeInterval(Double(timeout) / 1000.0)

        while Date() < deadline {
            if let element = refMap[ref] {
                if hidden {
                    // Wait for element to disappear — it still exists, keep waiting
                } else if enabled {
                    // Wait for element to become enabled
                    var enabledRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabledRef)
                    if (enabledRef as? Bool) == true {
                        return (["ok": true, "ref": ref, "state": "enabled"], nil)
                    }
                } else {
                    // Element exists — success
                    return (["ok": true, "ref": ref, "state": "visible"], nil)
                }
            } else {
                if hidden {
                    // Element gone — success for --hidden mode
                    return (["ok": true, "ref": ref, "state": "hidden"], nil)
                }
            }
            Thread.sleep(forTimeInterval: 0.2) // Poll every 200ms
        }

        return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.timeout,
            message: "Timeout waiting for element: \(ref)"))
    }

    /// Wait for an app to launch
    static func waitForApp(
        name: String,
        timeout: Int
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        let deadline = Date().addingTimeInterval(Double(timeout) / 1000.0)

        while Date() < deadline {
            for app in NSWorkspace.shared.runningApplications {
                if app.localizedName?.lowercased() == name.lowercased() && app.isFinishedLaunching {
                    return (["ok": true, "app": name, "pid": Int(app.processIdentifier)], nil)
                }
            }
            Thread.sleep(forTimeInterval: 0.2)
        }

        return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.timeout,
            message: "Timeout waiting for app: \(name)"))
    }

    /// Wait for a window with a given title
    static func waitForWindow(
        title: String,
        timeout: Int,
        windowManager: WindowManager
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        let deadline = Date().addingTimeInterval(Double(timeout) / 1000.0)

        while Date() < deadline {
            let windows = windowManager.listWindows()
            for win in windows {
                if let winTitle = win["title"] as? String,
                   winTitle.lowercased().contains(title.lowercased()) {
                    return (["ok": true, "window": win], nil)
                }
            }
            Thread.sleep(forTimeInterval: 0.2)
        }

        return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.timeout,
            message: "Timeout waiting for window: \(title)"))
    }

    /// Wait for text to appear (or disappear) in the active window
    static func waitForText(
        text: String,
        gone: Bool,
        timeout: Int,
        grabbedWindow: String?,
        windowManager: WindowManager,
        snapshotBuilder: SnapshotBuilder
    ) -> (result: [String: Any]?, error: RPCResponse?) {
        let deadline = Date().addingTimeInterval(Double(timeout) / 1000.0)

        while Date() < deadline {
            let (snapResult, _) = snapshotBuilder.build(
                windowRef: grabbedWindow,
                windowManager: windowManager
            )

            if let snapResult = snapResult,
               let elements = snapResult["elements"] as? [[String: Any]] {
                let found = searchForText(elements, text: text)

                if gone && !found {
                    return (["ok": true, "text": text, "state": "gone"], nil)
                } else if !gone && found {
                    return (["ok": true, "text": text, "state": "found"], nil)
                }
            }

            Thread.sleep(forTimeInterval: 0.3)
        }

        return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.timeout,
            message: "Timeout waiting for text: \(text)"))
    }

    private static func searchForText(_ elements: [[String: Any]], text: String) -> Bool {
        let lowerText = text.lowercased()
        for el in elements {
            if let label = el["label"] as? String, label.lowercased().contains(lowerText) {
                return true
            }
            if let value = el["value"] as? String, value.lowercased().contains(lowerText) {
                return true
            }
            if let children = el["children"] as? [[String: Any]] {
                if searchForText(children, text: lowerText) { return true }
            }
        }
        return false
    }
}
