import Foundation
import AppKit

enum Apps {

    /// List running applications
    static func listRunning() -> [[String: Any]] {
        let workspace = NSWorkspace.shared
        return workspace.runningApplications
            .filter { $0.activationPolicy == .regular } // Only GUI apps
            .map { app in
                [
                    "name": app.localizedName ?? "Unknown",
                    "bundle_id": app.bundleIdentifier ?? "",
                    "process_id": app.processIdentifier,
                    "is_active": app.isActive,
                    "is_hidden": app.isHidden,
                    "is_chromium": isChromiumApp(app),
                ] as [String: Any]
            }
    }

    /// Launch an application by name
    static func launch(name: String, waitUntilReady: Bool = false, background: Bool = false, openPaths: [String] = []) throws -> [String: Any] {
        let workspace = NSWorkspace.shared

        // Find the app URL
        guard let appURL = workspace.urlForApplication(withBundleIdentifier: bundleIdForName(name))
                ?? findAppByName(name) else {
            throw AppError.notFound(name)
        }

        let config = NSWorkspace.OpenConfiguration()
        config.activates = !background

        if !openPaths.isEmpty {
            let urls = openPaths.compactMap { URL(string: $0) ?? URL(fileURLWithPath: $0) }
            let semaphore = DispatchSemaphore(value: 0)
            var launchedApp: NSRunningApplication?
            var launchError: Error?

            workspace.open(urls, withApplicationAt: appURL, configuration: config) { app, error in
                launchedApp = app
                launchError = error
                semaphore.signal()
            }
            semaphore.wait()

            if let error = launchError {
                throw AppError.launchFailed(name, error.localizedDescription)
            }

            if waitUntilReady, let app = launchedApp {
                waitForApp(app)
            }

            return appInfo(launchedApp)
        } else {
            let semaphore = DispatchSemaphore(value: 0)
            var launchedApp: NSRunningApplication?
            var launchError: Error?

            workspace.openApplication(at: appURL, configuration: config) { app, error in
                launchedApp = app
                launchError = error
                semaphore.signal()
            }
            semaphore.wait()

            if let error = launchError {
                throw AppError.launchFailed(name, error.localizedDescription)
            }

            if waitUntilReady, let app = launchedApp {
                waitForApp(app)
            }

            return appInfo(launchedApp)
        }
    }

    /// Quit an application by name
    static func quit(name: String, force: Bool = false) throws {
        guard let app = findRunningApp(name) else {
            throw AppError.notFound(name)
        }

        if force {
            app.forceTerminate()
        } else {
            app.terminate()
        }
    }

    /// Hide an application
    static func hide(name: String) throws {
        guard let app = findRunningApp(name) else {
            throw AppError.notFound(name)
        }
        app.hide()
    }

    /// Unhide an application
    static func unhide(name: String) throws {
        guard let app = findRunningApp(name) else {
            throw AppError.notFound(name)
        }
        app.unhide()
    }

    /// Activate (bring to foreground) an application
    static func activate(name: String) throws {
        guard let app = findRunningApp(name) else {
            throw AppError.notFound(name)
        }
        app.activate(options: .activateIgnoringOtherApps)
    }

    // MARK: - Helpers

    private static func findRunningApp(_ name: String) -> NSRunningApplication? {
        let workspace = NSWorkspace.shared
        // Try by name first
        if let app = workspace.runningApplications.first(where: {
            $0.localizedName?.lowercased() == name.lowercased()
        }) {
            return app
        }
        // Try by bundle ID
        if let app = workspace.runningApplications.first(where: {
            $0.bundleIdentifier?.lowercased() == name.lowercased()
        }) {
            return app
        }
        return nil
    }

    private static func findAppByName(_ name: String) -> URL? {
        let workspace = NSWorkspace.shared
        // Search in /Applications
        let paths = [
            "/Applications/\(name).app",
            "/System/Applications/\(name).app",
            "/Applications/Utilities/\(name).app",
            "/System/Applications/Utilities/\(name).app",
        ]
        for path in paths {
            let url = URL(fileURLWithPath: path)
            if FileManager.default.fileExists(atPath: path) {
                return url
            }
        }
        // Try fullTextSearch via LSCopyApplicationURLsForBundleIdentifier
        return workspace.urlForApplication(withBundleIdentifier: name)
    }

    private static func bundleIdForName(_ name: String) -> String {
        // Common name -> bundle ID mappings
        let map: [String: String] = [
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
            "terminal": "com.apple.Terminal",
        ]
        return map[name.lowercased()] ?? name
    }

    private static func waitForApp(_ app: NSRunningApplication, timeout: TimeInterval = 10) {
        let deadline = Date().addingTimeInterval(timeout)
        while !app.isFinishedLaunching && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.1)
        }
    }

    private static func appInfo(_ app: NSRunningApplication?) -> [String: Any] {
        guard let app = app else { return [:] }
        return [
            "name": app.localizedName ?? "Unknown",
            "bundle_id": app.bundleIdentifier ?? "",
            "process_id": app.processIdentifier,
            "is_active": app.isActive,
            "is_hidden": app.isHidden,
            "is_chromium": isChromiumApp(app),
        ]
    }

    /// Detect if an app is Electron/Chromium-based by checking its bundle for known frameworks
    static func isChromiumApp(_ app: NSRunningApplication) -> Bool {
        guard let bundleURL = app.bundleURL else { return false }
        let frameworksPath = bundleURL.appendingPathComponent("Contents/Frameworks")
        let fm = FileManager.default

        guard let contents = try? fm.contentsOfDirectory(atPath: frameworksPath.path) else {
            return false
        }

        let chromiumMarkers = [
            "Electron Framework.framework",
            "Chromium Embedded Framework.framework",
            "CefSharp.BrowserSubprocess",
            "nwjs Framework.framework",
        ]

        for marker in chromiumMarkers {
            if contents.contains(marker) {
                return true
            }
        }
        return false
    }

    /// Check by app name or PID
    static func isChromiumApp(name: String) -> Bool {
        guard let app = findRunningApp(name) else { return false }
        return isChromiumApp(app)
    }

    static func isChromiumApp(pid: pid_t) -> Bool {
        guard let app = NSWorkspace.shared.runningApplications.first(where: {
            $0.processIdentifier == pid
        }) else { return false }
        return isChromiumApp(app)
    }
}

enum AppError: Error, CustomStringConvertible {
    case notFound(String)
    case launchFailed(String, String)

    var description: String {
        switch self {
        case .notFound(let name): return "Application not found: \(name)"
        case .launchFailed(let name, let reason): return "Failed to launch \(name): \(reason)"
        }
    }
}
