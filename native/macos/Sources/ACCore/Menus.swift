import Foundation
import ApplicationServices
import AppKit

// MARK: - Menu Bar Navigation

class Menus {

    /// Click a menu item by path (e.g. "File > Save")
    static func clickByPath(
        path: String,
        appName: String?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard let menuBar = getMenuBar(appName: appName) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Could not access menu bar"))
        }

        let parts = path.split(separator: ">").map { $0.trimmingCharacters(in: .whitespaces) }
        guard !parts.isEmpty else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Empty menu path"))
        }

        // Navigate through the menu hierarchy
        var currentElement = menuBar
        for (index, part) in parts.enumerated() {
            guard let child = findMenuItem(in: currentElement, named: part) else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                    message: "Menu item not found: \(part) (in path: \(path))"))
            }

            if index == parts.count - 1 {
                // Last item — press it
                AXUIElementPerformAction(child, kAXPressAction as CFString)
                return (["ok": true, "path": path], nil)
            } else {
                // Intermediate item — open it to access children
                AXUIElementPerformAction(child, kAXPressAction as CFString)
                Thread.sleep(forTimeInterval: 0.1)

                // Get the submenu
                var submenuRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXChildrenAttribute as CFString, &submenuRef)
                if let children = submenuRef as? [AXUIElement], let submenu = children.first {
                    currentElement = submenu
                } else {
                    currentElement = child
                }
            }
        }

        return (["ok": true, "path": path], nil)
    }

    /// List menu bar items
    static func list(
        menuName: String?,
        all: Bool,
        appName: String?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard let menuBar = getMenuBar(appName: appName) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Could not access menu bar"))
        }

        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(menuBar, kAXChildrenAttribute as CFString, &childrenRef)
        guard let menuItems = childrenRef as? [AXUIElement] else {
            return (["ok": true, "items": [] as [Any]], nil)
        }

        if let menuName = menuName {
            // List items under a specific menu
            for item in menuItems {
                let title = getTitle(item)
                if title.lowercased() == menuName.lowercased() {
                    // Open this menu to get children
                    AXUIElementPerformAction(item, kAXPressAction as CFString)
                    Thread.sleep(forTimeInterval: 0.1)

                    var submenuRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(item, kAXChildrenAttribute as CFString, &submenuRef)

                    var items: [[String: Any]] = []
                    if let children = submenuRef as? [AXUIElement] {
                        for child in children {
                            items.append(contentsOf: walkMenu(child, depth: 0, maxDepth: all ? 5 : 1))
                        }
                    }

                    // Close the menu
                    Keyboard.pressKey(combo: "escape")

                    return (["ok": true, "menu": menuName, "items": items], nil)
                }
            }
            // Close any open menu
            Keyboard.pressKey(combo: "escape")
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.elementNotFound,
                message: "Menu not found: \(menuName)"))
        }

        // List top-level menus
        var topLevel: [[String: Any]] = []
        for item in menuItems {
            let title = getTitle(item)
            if !title.isEmpty {
                topLevel.append(["title": title])
            }
        }

        return (["ok": true, "items": topLevel], nil)
    }

    /// List menu bar extras (right side)
    static func listExtras() -> (result: [String: Any]?, error: RPCResponse?) {
        var extras: [[String: Any]] = []

        // Get the status bar items from the menu bar app
        for app in NSWorkspace.shared.runningApplications {
            if app.bundleIdentifier == "com.apple.controlcenter" ||
               app.bundleIdentifier == "com.apple.systemuiserver" {
                let appElement = AXUIElementCreateApplication(app.processIdentifier)
                var menuBarRef: CFTypeRef?
                let result = AXUIElementCopyAttributeValue(appElement, kAXExtrasMenuBarAttribute as CFString, &menuBarRef)
                if result == .success, let menuBarRef = menuBarRef {
                    // Force cast — we know this is an AXUIElement from the AX API
                    let menuBar = menuBarRef as! AXUIElement
                    var childrenRef: CFTypeRef?
                    AXUIElementCopyAttributeValue(menuBar, kAXChildrenAttribute as CFString, &childrenRef)
                    if let children = childrenRef as? [AXUIElement] {
                        for child in children {
                            let title = getTitle(child)
                            extras.append(["title": title.isEmpty ? "(unnamed)" : title,
                                         "app": app.localizedName ?? "Unknown"])
                        }
                    }
                }
            }
        }

        return (["ok": true, "extras": extras], nil)
    }

    // MARK: - Helpers

    private static func getMenuBar(appName: String?) -> AXUIElement? {
        let pid: pid_t
        if let appName = appName {
            guard let app = NSWorkspace.shared.runningApplications.first(where: {
                $0.localizedName?.lowercased() == appName.lowercased()
            }) else { return nil }
            pid = app.processIdentifier
        } else {
            guard let app = NSWorkspace.shared.frontmostApplication else { return nil }
            pid = app.processIdentifier
        }

        let appElement = AXUIElementCreateApplication(pid)
        var menuBarRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXMenuBarAttribute as CFString, &menuBarRef)
        guard result == .success else { return nil }
        // AX API returns AXUIElement as CFTypeRef
        return (menuBarRef as! AXUIElement)
    }

    private static func findMenuItem(in element: AXUIElement, named name: String) -> AXUIElement? {
        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return nil }

        for child in children {
            let title = getTitle(child)
            if title.lowercased() == name.lowercased() {
                return child
            }
            // Also check in submenus
            if let found = findMenuItem(in: child, named: name) {
                return found
            }
        }
        return nil
    }

    private static func getTitle(_ element: AXUIElement) -> String {
        var titleRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleRef)
        return titleRef as? String ?? ""
    }

    private static func walkMenu(_ element: AXUIElement, depth: Int, maxDepth: Int) -> [[String: Any]] {
        var results: [[String: Any]] = []

        var childrenRef: CFTypeRef?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
        guard let children = childrenRef as? [AXUIElement] else { return results }

        for child in children {
            let title = getTitle(child)
            var roleRef: CFTypeRef?
            AXUIElementCopyAttributeValue(child, kAXRoleAttribute as CFString, &roleRef)
            let role = roleRef as? String ?? ""

            // Skip separators
            if role == "AXMenuItem" || role == "AXMenuBarItem" {
                var item: [String: Any] = ["title": title]

                var enabledRef: CFTypeRef?
                AXUIElementCopyAttributeValue(child, kAXEnabledAttribute as CFString, &enabledRef)
                item["enabled"] = (enabledRef as? Bool) ?? true

                if depth < maxDepth {
                    let subItems = walkMenu(child, depth: depth + 1, maxDepth: maxDepth)
                    if !subItems.isEmpty {
                        item["children"] = subItems
                    }
                }

                if !title.isEmpty {
                    results.append(item)
                }
            }
        }

        return results
    }
}
