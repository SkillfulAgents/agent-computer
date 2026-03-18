import Foundation
import ApplicationServices
import AppKit

// MARK: - Snapshot Builder

class SnapshotBuilder {
    private let refAssigner = RefAssigner()
    private var refToElement: [String: AXUIElement] = [:]
    private var elementCount = 0
    private let maxElements = 500  // Safety limit

    /// Build a snapshot of the given window's AX tree
    func build(
        windowRef: String?,
        windowManager: WindowManager,
        interactive: Bool = false,
        compact: Bool = false,
        depth: Int? = nil,
        subtreeRef: String? = nil,
        appName: String? = nil,
        pid: pid_t? = nil
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // Determine target PID
        let targetPID: pid_t
        if let pid = pid {
            targetPID = pid
        } else if let appName = appName {
            guard let app = findRunningApp(name: appName) else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.appNotFound,
                    message: "Application not found: \(appName)"))
            }
            targetPID = app.processIdentifier
        } else if let windowRef = windowRef {
            guard let winPID = windowManager.getPID(ref: windowRef) else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                    message: "Window not found: \(windowRef)"))
            }
            targetPID = winPID
        } else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "No window grabbed. Use 'ac grab <@w>' first."))
        }

        // Get AX app element
        let appElement = AXUIElementCreateApplication(targetPID)

        // Get windows
        var windowsRef: CFTypeRef?
        let windowsResult = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        guard windowsResult == .success, let axWindows = windowsRef as? [AXUIElement], !axWindows.isEmpty else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                message: "No accessible windows found for PID \(targetPID)"))
        }

        // Use first window (or find matching window)
        let axWindow = axWindows[0]

        // Get window info
        let windowInfo = getWindowInfo(axWindow, pid: targetPID, windowManager: windowManager)

        // Reset ref assigner for fresh snapshot
        refAssigner.reset()
        refToElement = [:]
        elementCount = 0

        // Walk the tree
        let maxDepth = depth ?? 50
        let elements: [[String: Any]]

        if let subtreeRef = subtreeRef {
            // Do a full walk first to populate the ref map
            _ = walkTree(element: axWindow, depth: 0, maxDepth: maxDepth, interactive: false)
            guard let subtreeElement = refToElement[subtreeRef] else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "Subtree root not found: \(subtreeRef)"))
            }
            // Now walk just the subtree with a fresh assigner
            refAssigner.reset()
            refToElement = [:]
            elements = walkTree(element: subtreeElement, depth: 0, maxDepth: maxDepth, interactive: interactive)
        } else {
            elements = walkTree(element: axWindow, depth: 0, maxDepth: maxDepth, interactive: interactive)
        }

        let snapshotId = UUID().uuidString.prefix(8).lowercased()

        var result: [String: Any] = [
            "snapshot_id": String(snapshotId),
            "window": windowInfo,
            "fallback": NSNull(),
        ]

        if compact {
            // Flatten the tree
            result["elements"] = flattenElements(elements)
        } else {
            result["elements"] = elements
        }

        return (result, nil)
    }

    /// Get the ref -> AXUIElement mapping (for click/interaction commands)
    func getRefMap() -> [String: AXUIElement] {
        return refToElement
    }

    // MARK: - Tree Walking

    private func walkTree(element: AXUIElement, depth: Int, maxDepth: Int, interactive: Bool) -> [[String: Any]] {
        if depth >= maxDepth { return [] }
        if elementCount >= maxElements { return [] }

        var results: [[String: Any]] = []

        // Get children with timeout protection
        var childrenRef: CFTypeRef?
        AXUIElementSetMessagingTimeout(element, 2.0) // 2 second timeout per element
        let childResult = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)

        guard childResult == .success, let children = childrenRef as? [AXUIElement] else {
            return results
        }

        for child in children {
            if elementCount >= maxElements { break }
            guard let elementInfo = buildElementInfo(child, depth: depth, maxDepth: maxDepth, interactive: interactive) else {
                continue
            }
            results.append(elementInfo)
        }

        return results
    }

    private func buildElementInfo(_ element: AXUIElement, depth: Int, maxDepth: Int, interactive: Bool) -> [String: Any]? {
        if elementCount >= maxElements { return nil }

        // Get role
        AXUIElementSetMessagingTimeout(element, 2.0)
        let role = getStringAttribute(element, kAXRoleAttribute)
        guard let role = role else { return nil }

        elementCount += 1

        let normalizedRole = normalizeRole(role)

        // Filter interactive-only
        if interactive && !isInteractiveRole(normalizedRole) {
            // Still recurse into children — a non-interactive container might contain interactive elements
            let childElements = walkTree(element: element, depth: depth + 1, maxDepth: maxDepth, interactive: interactive)
            if childElements.isEmpty {
                return nil
            }
            // Include the container with its interactive children
            let ref = refAssigner.assign(role: normalizedRole)
            refToElement[ref] = element

            var info: [String: Any] = [
                "ref": ref,
                "role": normalizedRole,
                "label": getStringAttribute(element, kAXTitleAttribute) ?? getStringAttribute(element, kAXDescriptionAttribute) as Any,
                "value": NSNull(),
                "enabled": true,
                "focused": false,
                "bounds": getBounds(element),
            ]
            info["children"] = childElements
            return info
        }

        // Assign ref
        let ref = refAssigner.assign(role: normalizedRole)
        refToElement[ref] = element

        // Get attributes
        let label = getStringAttribute(element, kAXTitleAttribute)
            ?? getStringAttribute(element, kAXDescriptionAttribute)
        let value = getStringAttribute(element, kAXValueAttribute)
        let enabled = getBoolAttribute(element, kAXEnabledAttribute) ?? true
        let focused = getBoolAttribute(element, kAXFocusedAttribute) ?? false
        let bounds = getBounds(element)

        var info: [String: Any] = [
            "ref": ref,
            "role": normalizedRole,
            "label": label as Any,
            "value": value as Any,
            "enabled": enabled,
            "focused": focused,
            "bounds": bounds,
        ]

        // Recurse into children (if not at max depth)
        if depth + 1 < maxDepth {
            let childElements = walkTree(element: element, depth: depth + 1, maxDepth: maxDepth, interactive: interactive)
            if !childElements.isEmpty {
                info["children"] = childElements
            }
        }

        return info
    }

    // MARK: - Flattening

    private func flattenElements(_ elements: [[String: Any]]) -> [[String: Any]] {
        var flat: [[String: Any]] = []
        for var el in elements {
            let children = el.removeValue(forKey: "children") as? [[String: Any]]
            flat.append(el)
            if let children = children {
                flat.append(contentsOf: flattenElements(children))
            }
        }
        return flat
    }

    // MARK: - Window Info

    private func getWindowInfo(_ window: AXUIElement, pid: pid_t, windowManager: WindowManager) -> [String: Any] {
        let title = getStringAttribute(window, kAXTitleAttribute) ?? ""
        let bounds = getBounds(window)
        let minimized = getBoolAttribute(window, kAXMinimizedAttribute) ?? false
        let fullscreen = getBoolAttribute(window, "AXFullScreen") ?? false

        // Use direct PID lookup instead of NSWorkspace cache
        var appName = "Unknown"
        var bundleId = ""
        var isHidden = false
        for runningApp in NSWorkspace.shared.runningApplications {
            if runningApp.processIdentifier == pid {
                appName = runningApp.localizedName ?? "Unknown"
                bundleId = runningApp.bundleIdentifier ?? ""
                isHidden = runningApp.isHidden
                break
            }
        }

        return [
            "ref": "@w1",
            "title": title,
            "app": appName,
            "bundle_id": bundleId,
            "process_id": Int(pid),
            "bounds": bounds,
            "minimized": minimized,
            "hidden": isHidden,
            "fullscreen": fullscreen,
        ]
    }

    // MARK: - AX Attribute Helpers

    private func getStringAttribute(_ element: AXUIElement, _ attribute: String) -> String? {
        var value: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
        guard result == .success else { return nil }
        return value as? String
    }

    private func getBoolAttribute(_ element: AXUIElement, _ attribute: String) -> Bool? {
        var value: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
        guard result == .success else { return nil }
        if let num = value as? NSNumber {
            return num.boolValue
        }
        return value as? Bool
    }

    private func getBounds(_ element: AXUIElement) -> [Double] {
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

    // MARK: - Role Classification

    private func isInteractiveRole(_ role: String) -> Bool {
        let interactiveRoles: Set<String> = [
            "button", "textfield", "textarea", "link", "checkbox", "radio",
            "slider", "dropdown", "combobox", "stepper", "tab", "menuitem",
        ]
        return interactiveRoles.contains(role)
    }

    /// Find a running app by name, using direct process enumeration
    /// instead of NSWorkspace (which may be stale in daemon mode without a RunLoop)
    private func findRunningApp(name: String) -> NSRunningApplication? {
        // Try by localized name
        for app in NSWorkspace.shared.runningApplications {
            if app.localizedName?.lowercased() == name.lowercased() {
                return app
            }
        }
        // Try common bundle ID mappings
        let bundleMap: [String: String] = [
            "textedit": "com.apple.TextEdit",
            "calculator": "com.apple.calculator",
            "notes": "com.apple.Notes",
            "safari": "com.apple.Safari",
            "music": "com.apple.Music",
            "messages": "com.apple.MobileSMS",
            "calendar": "com.apple.iCal",
            "system settings": "com.apple.systempreferences",
            "preview": "com.apple.Preview",
            "finder": "com.apple.finder",
        ]
        if let bundleId = bundleMap[name.lowercased()] {
            let apps = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId)
            return apps.first
        }
        // Try the name itself as a bundle ID
        let apps = NSRunningApplication.runningApplications(withBundleIdentifier: name)
        return apps.first
    }
}
