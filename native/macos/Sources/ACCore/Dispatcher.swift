import Foundation
import ApplicationServices
import AppKit

// MARK: - Method Dispatcher

typealias MethodHandler = (RPCRequest) -> RPCResponse

class Dispatcher {
    private var handlers: [String: MethodHandler] = [:]
    private let startTime = Date()

    // Session state
    var grabbedWindow: String? = nil
    var lastSnapshotId: String? = nil
    var cdpPorts: [String: Int] = [:]  // lowercase app name → CDP port
    var kvStore: [String: Any] = [:]  // generic key-value store for cross-process state

    // Managers
    let windowManager = WindowManager()
    let snapshotBuilder = SnapshotBuilder()
    var lastRefMap: [String: AXUIElement] = [:]
    var lastSnapshotData: [String: Any]? = nil

    // Overlay
    var haloOverlay: HaloOverlay? = nil

    init() {
        registerBuiltinMethods()
        registerAppMethods()
        registerWindowMethods()
        registerSnapshotMethods()
        registerActionMethods()
        registerKeyboardMethods()
        registerClipboardMethods()
        registerCaptureMethods()
        registerScrollMethods()
        registerFocusMethods()
        registerFindMethods()
        registerReadMethods()
        registerWaitMethods()
        registerMenuMethods()
        registerDialogMethods()
        registerDragMethods()
        registerBatchMethods()
        registerDiffMethods()
        registerHumanLikeMethods()
    }

    private func registerBuiltinMethods() {
        register("ping") { req in
            .success(id: req.id, result: ["pong": true])
        }

        register("status") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let uptime = Int(Date().timeIntervalSince(self.startTime) * 1000)
            var grabbedApp: String? = nil
            var grabbedPid: Int? = nil
            if let ref = self.grabbedWindow, let info = self.windowManager.getWindowInfo(ref: ref) {
                grabbedApp = info["app"] as? String
                grabbedPid = info["process_id"] as? Int
            }
            return .success(id: req.id, result: [
                "grabbed_window": self.grabbedWindow as Any,
                "grabbed_app": grabbedApp as Any,
                "grabbed_pid": grabbedPid as Any,
                "last_snapshot_id": self.lastSnapshotId as Any,
                "daemon_pid": ProcessInfo.processInfo.processIdentifier,
                "daemon_uptime_ms": uptime,
            ] as [String: Any])
        }

        register("version") { req in
            .success(id: req.id, result: ["version": "0.1.0"])
        }

        register("shutdown") { req in
            // Return success, then the daemon loop will check for shutdown
            .success(id: req.id, result: ["ok": true])
        }

        register("permissions") { req in
            let accessibility = Permissions.isAccessibilityTrusted()
            let screenRecording = Permissions.isScreenRecordingGranted()
            return .success(id: req.id, result: [
                "accessibility": accessibility,
                "screen_recording": screenRecording,
            ])
        }

        register("permissions_grant") { req in
            Permissions.openAccessibilitySettings()
            return .success(id: req.id, result: ["ok": true])
        }

        register("kv_set") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let key = req.paramString("key") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing key")
            }
            self.kvStore[key] = req.params?["value"]?.value
            return .success(id: req.id, result: ["ok": true])
        }

        register("kv_get") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let key = req.paramString("key") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing key")
            }
            if let value = self.kvStore[key] {
                return .success(id: req.id, result: ["key": key, "value": value])
            }
            return .success(id: req.id, result: ["key": key, "value": NSNull()])
        }
    }

    // MARK: - Halo Overlay

    private func showHalo(for ref: String) {
        guard let windowID = windowManager.getWindowID(ref: ref) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.haloOverlay?.remove()
            self?.haloOverlay = HaloOverlay(windowID: windowID)
        }
    }

    private func hideHalo() {
        DispatchQueue.main.async { [weak self] in
            self?.haloOverlay?.remove()
            self?.haloOverlay = nil
        }
    }

    // MARK: - App Methods

    private func registerAppMethods() {
        register("apps") { req in
            let running = req.paramBool("running") ?? true
            if running {
                let apps = Apps.listRunning()
                return .success(id: req.id, result: ["apps": apps])
            }
            return .success(id: req.id, result: ["apps": Apps.listRunning()])
        }

        register("launch") { req in
            guard let name = req.paramString("name") ?? req.paramString("ref") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            let wait = req.paramBool("wait") ?? false
            let background = req.paramBool("background") ?? false
            do {
                let info = try Apps.launch(name: name, waitUntilReady: wait, background: background)
                return .success(id: req.id, result: info)
            } catch let error as AppError {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.description)
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("quit") { req in
            guard let name = req.paramString("name") ?? req.paramString("ref") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            let force = req.paramBool("force") ?? false
            do {
                try Apps.quit(name: name, force: force)
                return .success(id: req.id, result: ["ok": true])
            } catch let error as AppError {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.description)
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("hide") { req in
            guard let name = req.paramString("name") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            do {
                try Apps.hide(name: name)
                return .success(id: req.id, result: ["ok": true])
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("unhide") { req in
            guard let name = req.paramString("name") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            do {
                try Apps.unhide(name: name)
                return .success(id: req.id, result: ["ok": true])
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("switch") { req in
            guard let name = req.paramString("name") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            do {
                try Apps.activate(name: name)
                return .success(id: req.id, result: ["ok": true])
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("app_executable") { req in
            guard let name = req.paramString("name") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            if let path = Apps.executablePath(name: name) {
                return .success(id: req.id, result: ["executable": path])
            }
            return .error(id: req.id, code: RPCErrorCode.appNotFound, message: "Could not find executable for \(name)")
        }

        register("is_chromium") { req in
            guard let name = req.paramString("name") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            return .success(id: req.id, result: ["is_chromium": Apps.isChromiumBundle(name: name)])
        }

        register("launch_cdp") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let name = req.paramString("name") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            let port = req.paramInt("port") ?? 19200
            do {
                let info = try Apps.launchWithCDP(name: name, port: port)
                self.cdpPorts[name.lowercased()] = port
                return .success(id: req.id, result: info)
            } catch let error as AppError {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.description)
            } catch {
                return .error(id: req.id, code: RPCErrorCode.appNotFound, message: error.localizedDescription)
            }
        }

        register("cdp_port") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let name = req.paramString("name") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing app name")
            }
            if let port = self.cdpPorts[name.lowercased()] {
                return .success(id: req.id, result: ["port": port, "name": name])
            }
            return .success(id: req.id, result: ["port": NSNull(), "name": name])
        }
    }

    // MARK: - Window Methods

    private func registerWindowMethods() {
        register("windows") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let appName = req.paramString("app")
            let windows = self.windowManager.listWindows(appName: appName)
            return .success(id: req.id, result: ["windows": windows])
        }

        register("grab") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            // Grab by ref or by app name
            if let appName = req.paramString("app") {
                // Refresh windows and find first for this app
                guard let ref = self.windowManager.getWindowRefForApp(appName: appName) else {
                    return .error(id: req.id, code: RPCErrorCode.windowNotFound,
                                  message: "No window found for app: \(appName)")
                }
                self.grabbedWindow = ref
                self.showHalo(for: ref)
                let info = self.windowManager.getWindowInfo(ref: ref) ?? [:]
                return .success(id: req.id, result: ["ok": true, "window": info] as [String: Any])
            }

            guard let ref = req.paramString("ref") ?? (req.params?["_positional"]?.value as? [Any])?.first as? String else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing window ref or --app name")
            }

            // Verify the ref exists
            if self.windowManager.getWindowInfo(ref: ref) == nil {
                // Refresh window list and try again
                _ = self.windowManager.listWindows()
                if self.windowManager.getWindowInfo(ref: ref) == nil {
                    return .error(id: req.id, code: RPCErrorCode.windowNotFound,
                                  message: "Window not found: \(ref)",
                                  data: ["available_windows": self.windowManager.listWindows().compactMap { $0["ref"] as? String }])
                }
            }

            self.grabbedWindow = ref
            self.showHalo(for: ref)
            let info = self.windowManager.getWindowInfo(ref: ref) ?? [:]
            return .success(id: req.id, result: ["ok": true, "window": info] as [String: Any])
        }

        register("ungrab") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            self.hideHalo()
            self.grabbedWindow = nil
            return .success(id: req.id, result: ["ok": true])
        }

        // Window action methods
        for method in ["minimize", "maximize", "fullscreen", "close", "raise"] {
            register(method) { [weak self] req in
                guard let self = self else {
                    return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
                }
                let ref = req.paramString("ref") ?? self.grabbedWindow
                guard let ref = ref else {
                    return .error(id: req.id, code: RPCErrorCode.invalidParams,
                                  message: "Missing window ref. Grab a window or pass --ref.")
                }

                // Refresh windows to ensure ref is valid
                if self.windowManager.getWindowInfo(ref: ref) == nil {
                    _ = self.windowManager.listWindows()
                }

                let (result, error): ([String: Any]?, RPCResponse?)
                switch method {
                case "minimize": (result, error) = self.windowManager.minimize(ref: ref)
                case "maximize": (result, error) = self.windowManager.maximize(ref: ref)
                case "fullscreen": (result, error) = self.windowManager.fullscreen(ref: ref)
                case "close": (result, error) = self.windowManager.close(ref: ref)
                case "raise": (result, error) = self.windowManager.raise(ref: ref)
                default: return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Unknown method")
                }

                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }
        }

        register("move") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let ref = req.paramString("ref") ?? self.grabbedWindow
            guard let ref = ref else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing window ref")
            }
            guard let x = req.paramDouble("x"), let y = req.paramDouble("y") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing x or y coordinate")
            }
            if self.windowManager.getWindowInfo(ref: ref) == nil {
                _ = self.windowManager.listWindows()
            }
            let (result, error) = self.windowManager.move(ref: ref, x: x, y: y)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("resize") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let ref = req.paramString("ref") ?? self.grabbedWindow
            guard let ref = ref else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing window ref")
            }
            guard let w = req.paramDouble("width"), let h = req.paramDouble("height") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing width or height")
            }
            if self.windowManager.getWindowInfo(ref: ref) == nil {
                _ = self.windowManager.listWindows()
            }
            let (result, error) = self.windowManager.resize(ref: ref, width: w, height: h)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("bounds") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let ref = req.paramString("ref") ?? self.grabbedWindow
            guard let ref = ref else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing window ref")
            }
            if self.windowManager.getWindowInfo(ref: ref) == nil {
                _ = self.windowManager.listWindows()
            }

            // Preset mode
            if let preset = req.paramString("preset") {
                let (result, error) = self.windowManager.applyPreset(ref: ref, preset: preset)
                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }

            // Explicit bounds
            guard let x = req.paramDouble("x"), let y = req.paramDouble("y"),
                  let w = req.paramDouble("width"), let h = req.paramDouble("height") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Missing bounds (x, y, width, height) or --preset")
            }
            let (result, error) = self.windowManager.setBounds(ref: ref, x: x, y: y, width: w, height: h)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Snapshot Methods

    private func registerSnapshotMethods() {
        register("snapshot") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let interactive = req.paramBool("interactive") ?? false
            let compact = req.paramBool("compact") ?? false
            let depth = req.paramInt("depth")
            let subtree = req.paramString("subtree")
            let appName = req.paramString("app")
            let pidParam = req.paramInt("pid")

            let (result, error) = self.snapshotBuilder.build(
                windowRef: self.grabbedWindow,
                windowManager: self.windowManager,
                interactive: interactive,
                compact: compact,
                depth: depth,
                subtreeRef: subtree,
                appName: appName,
                pid: pidParam != nil ? pid_t(pidParam!) : nil
            )

            if let error = error {
                // Fix the ID in the error response
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }

            guard let result = result else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Snapshot failed")
            }

            // Store ref map, snapshot ID, and snapshot data for subsequent commands
            self.lastRefMap = self.snapshotBuilder.getRefMap()
            self.lastSnapshotId = result["snapshot_id"] as? String
            self.lastSnapshotData = result

            // Check if the target app is Chromium/Electron and add a hint
            var finalResult = result
            let targetPid: pid_t?
            if let appName = appName {
                targetPid = NSWorkspace.shared.runningApplications.first(where: {
                    $0.localizedName?.lowercased() == appName.lowercased()
                })?.processIdentifier
            } else if let ref = self.grabbedWindow,
                      let info = self.windowManager.getWindowInfo(ref: ref),
                      let pid = info["process_id"] as? Int {
                targetPid = pid_t(pid)
            } else {
                targetPid = NSWorkspace.shared.frontmostApplication?.processIdentifier
            }
            if let pid = targetPid, Apps.isChromiumApp(pid: pid) {
                let chromiumAppName = appName ?? NSWorkspace.shared.runningApplications.first(where: { $0.processIdentifier == pid })?.localizedName ?? "AppName"
                finalResult["hint"] = "This is a Chromium/Electron app. Run `ac relaunch \(chromiumAppName)` to restart it with CDP support for a full accessibility tree." as Any
            }

            return .success(id: req.id, result: finalResult)
        }
    }

    // MARK: - Action Methods

    private func registerActionMethods() {
        register("click") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }

            let ref = req.paramString("ref")
            let x = req.paramDouble("x")
            let y = req.paramDouble("y")
            let right = req.paramBool("right") ?? false
            let double = req.paramBool("double") ?? false
            let count = req.paramInt("count") ?? 1
            let modifiers = req.paramStringArray("modifiers") ?? []

            let (result, error) = Actions.click(
                ref: ref, x: x, y: y,
                right: right, double: double, count: count,
                modifiers: modifiers, refMap: self.lastRefMap
            )

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            guard let result = result else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Click failed")
            }

            // Trigger ripple animation on the halo overlay
            if let halo = self.haloOverlay {
                var ripplePoint: CGPoint?
                if let bounds = result["bounds"] as? [Double], bounds.count >= 4 {
                    ripplePoint = CGPoint(x: bounds[0] + bounds[2] / 2.0, y: bounds[1] + bounds[3] / 2.0)
                } else if let x = x, let y = y {
                    ripplePoint = CGPoint(x: x, y: y)
                }
                if let pt = ripplePoint {
                    DispatchQueue.main.async { halo.showRipple(at: pt) }
                }
            }

            return .success(id: req.id, result: result)
        }

        register("hover") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }

            let ref = req.paramString("ref")
            let x = req.paramDouble("x")
            let y = req.paramDouble("y")

            let (result, error) = Actions.hover(
                ref: ref, x: x, y: y,
                refMap: self.lastRefMap
            )

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            guard let result = result else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Hover failed")
            }
            return .success(id: req.id, result: result)
        }

        register("mouse") { req in
            let action = req.paramString("action") ?? "down"
            let button = req.paramString("button") ?? "left"

            guard action == "down" || action == "up" else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Invalid mouse action: \(action). Use 'down' or 'up'.")
            }
            guard ["left", "right", "middle"].contains(button) else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Invalid mouse button: \(button). Use 'left', 'right', or 'middle'.")
            }

            let (result, error) = Actions.mouseButton(action: action, button: button)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            guard let result = result else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Mouse action failed")
            }
            return .success(id: req.id, result: result)
        }
    }

    // MARK: - App Focus Helper (for CGEvent-based commands)

    /// Activate the grabbed window's app and return the previously frontmost app.
    /// CGEvent keystrokes go to the frontmost app, so we need to switch first.
    /// Returns the app to restore afterwards, or nil if no switch was needed.
    private func activateGrabbedApp(explicit appName: String? = nil) -> NSRunningApplication? {
        let targetApp: String?
        if let appName = appName {
            targetApp = appName
        } else if let ref = grabbedWindow {
            // Resolve grabbed window ref to app name
            if let info = windowManager.getWindowInfo(ref: ref) {
                targetApp = info["app"] as? String
            } else {
                _ = windowManager.listWindows()
                targetApp = windowManager.getWindowInfo(ref: ref)?["app"] as? String
            }
        } else {
            return nil // No grab, no explicit app — send to frontmost
        }

        guard let targetApp = targetApp else { return nil }

        let previousApp = NSWorkspace.shared.frontmostApplication

        // Only switch if we're not already in the target app
        if previousApp?.localizedName?.lowercased() == targetApp.lowercased() {
            return nil
        }

        // Activate target app
        if let app = NSWorkspace.shared.runningApplications.first(where: {
            $0.localizedName?.lowercased() == targetApp.lowercased()
        }) {
            app.activate(options: .activateIgnoringOtherApps)
            Thread.sleep(forTimeInterval: 0.15)
        }

        return previousApp
    }

    /// Restore the previously frontmost app
    private func restoreApp(_ app: NSRunningApplication?) {
        guard let app = app else { return }
        Thread.sleep(forTimeInterval: 0.1)
        app.activate(options: .activateIgnoringOtherApps)
    }

    // MARK: - Keyboard Methods

    private func registerKeyboardMethods() {
        register("type") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let text = req.paramString("text") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing text parameter")
            }
            let delay = req.paramInt("delay")
            let appName = req.paramString("app")

            let previousApp = self.activateGrabbedApp(explicit: appName)
            let (result, error) = Keyboard.typeText(text: text, delay: delay)
            self.restoreApp(previousApp)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("fill") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            guard let text = req.paramString("text") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing text parameter")
            }

            let (result, error) = Keyboard.fill(ref: ref, text: text, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("key") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let combo = req.paramString("combo") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing combo parameter")
            }
            let repeatCount = req.paramInt("repeat") ?? 1
            let delay = req.paramInt("delay")
            let appName = req.paramString("app")

            let previousApp = self.activateGrabbedApp(explicit: appName)
            let (result, error) = Keyboard.key(combo: combo, repeat: repeatCount, delay: delay)
            self.restoreApp(previousApp)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("keydown") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let key = req.paramString("key") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing key parameter")
            }
            let appName = req.paramString("app")

            let previousApp = self.activateGrabbedApp(explicit: appName)
            let (result, error) = Keyboard.keyUpDown(key: key, down: true)
            self.restoreApp(previousApp)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("keyup") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let key = req.paramString("key") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing key parameter")
            }
            let appName = req.paramString("app")

            let previousApp = self.activateGrabbedApp(explicit: appName)
            let (result, error) = Keyboard.keyUpDown(key: key, down: false)
            self.restoreApp(previousApp)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("paste") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let text = req.paramString("text") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing text parameter")
            }
            let appName = req.paramString("app")

            let previousApp = self.activateGrabbedApp(explicit: appName)
            let (result, error) = Keyboard.paste(text: text)
            self.restoreApp(previousApp)

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Clipboard Methods

    private func registerClipboardMethods() {
        register("clipboard_read") { req in
            let (result, _) = ClipboardManager.read()
            return .success(id: req.id, result: result!)
        }

        register("clipboard_set") { req in
            guard let text = req.paramString("text") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing text parameter")
            }
            let (result, _) = ClipboardManager.set(text: text)
            return .success(id: req.id, result: result!)
        }

        register("clipboard_copy") { req in
            let (result, _) = ClipboardManager.copy()
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Capture Methods

    private func registerCaptureMethods() {
        register("screenshot") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let windowRef = req.paramString("ref") ?? self.grabbedWindow
            let fullScreen = req.paramBool("screen") ?? false
            let retina = req.paramBool("retina") ?? false
            let format = req.paramString("format") ?? "png"
            let quality = req.paramInt("quality") ?? 85
            let outputPath = req.paramString("path")

            let (result, error) = Capture.screenshot(
                windowRef: fullScreen ? nil : windowRef,
                windowManager: self.windowManager,
                fullScreen: fullScreen,
                retina: retina,
                format: format,
                quality: quality,
                outputPath: outputPath
            )

            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("displays") { req in
            let displays = Capture.listDisplays()
            return .success(id: req.id, result: ["displays": displays])
        }
    }

    // MARK: - Scroll Methods

    private func registerScrollMethods() {
        register("scroll") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let direction = req.paramString("direction") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing direction parameter")
            }
            let amount = req.paramInt("amount") ?? 3
            let onRef = req.paramString("on")
            let pixels = req.paramInt("pixels")
            let smooth = req.paramBool("smooth") ?? false

            let (result, error) = Scroll.scroll(
                direction: direction, amount: amount, onRef: onRef,
                pixels: pixels, smooth: smooth, refMap: self.lastRefMap
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Focus Methods

    private func registerFocusMethods() {
        register("focus") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Focus.focus(ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("select") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            guard let value = req.paramString("value") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing value parameter")
            }
            let (result, error) = Focus.select(ref: ref, value: value, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("check") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Focus.check(ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("uncheck") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Focus.uncheck(ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("set") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            guard let value = req.paramString("value") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing value parameter")
            }
            let (result, error) = Focus.setValue(ref: ref, value: value, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Find Methods

    private func registerFindMethods() {
        register("find") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let text = req.paramString("text")
            let role = req.paramString("role")
            let first = req.paramBool("first") ?? false
            let appName = req.paramString("app")

            if text == nil && role == nil {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Either text or --role is required")
            }

            let (result, error) = Find.find(
                text: text, role: role, first: first,
                windowRef: nil, appName: appName,
                windowManager: self.windowManager,
                snapshotBuilder: self.snapshotBuilder,
                grabbedWindow: self.grabbedWindow
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            // Store ref map from the snapshot used for search
            self.lastRefMap = self.snapshotBuilder.getRefMap()
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Read Methods

    private func registerReadMethods() {
        register("read") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let attr = req.paramString("attr")
            let (result, error) = Read.read(ref: ref, attr: attr, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("title") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let appMode = req.paramBool("app") ?? false
            let (result, error) = Read.title(
                appMode: appMode,
                grabbedWindow: self.grabbedWindow,
                windowManager: self.windowManager
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("is") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let state = req.paramString("state") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing state parameter")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Read.isState(state: state, ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("box") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Read.box(ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("children") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            let (result, error) = Read.children(ref: ref, refMap: self.lastRefMap)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Wait Methods

    private func registerWaitMethods() {
        register("wait") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let timeout = req.paramInt("timeout") ?? 10000

            // Wait for fixed duration
            if let ms = req.paramInt("ms") {
                let result = Wait.waitMs(ms: ms)
                return .success(id: req.id, result: result)
            }

            // Wait for app
            if let appName = req.paramString("app") {
                let (result, error) = Wait.waitForApp(name: appName, timeout: timeout)
                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }

            // Wait for window
            if let windowTitle = req.paramString("window") {
                let (result, error) = Wait.waitForWindow(
                    title: windowTitle, timeout: timeout,
                    windowManager: self.windowManager
                )
                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }

            // Wait for text
            if let text = req.paramString("text") {
                let gone = req.paramBool("gone") ?? false
                let (result, error) = Wait.waitForText(
                    text: text, gone: gone, timeout: timeout,
                    grabbedWindow: self.grabbedWindow,
                    windowManager: self.windowManager,
                    snapshotBuilder: self.snapshotBuilder
                )
                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }

            // Wait for element
            if let ref = req.paramString("ref") {
                let hidden = req.paramBool("hidden") ?? false
                let enabled = req.paramBool("enabled") ?? false
                let (result, error) = Wait.waitForElement(
                    ref: ref, hidden: hidden, enabled: enabled,
                    timeout: timeout, refMap: self.lastRefMap
                )
                if let error = error {
                    return .error(id: req.id, code: error.error?.code ?? -32600,
                                  message: error.error?.message ?? "Unknown error")
                }
                return .success(id: req.id, result: result!)
            }

            return .error(id: req.id, code: RPCErrorCode.invalidParams,
                          message: "wait requires: ms, --app, --window, --text, or ref")
        }
    }

    // MARK: - Menu Methods

    private func registerMenuMethods() {
        register("menu_click") { req in
            guard let path = req.paramString("path") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing menu path")
            }
            let appName = req.paramString("app")
            let (result, error) = Menus.clickByPath(path: path, appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("menu_list") { req in
            let menuName = req.paramString("menu")
            let all = req.paramBool("all") ?? false
            let appName = req.paramString("app")
            let (result, error) = Menus.list(menuName: menuName, all: all, appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("menubar") { req in
            let (result, error) = Menus.listExtras()
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Dialog Methods

    private func registerDialogMethods() {
        register("dialog") { req in
            let appName = req.paramString("app")
            let (result, error) = Dialog.detect(appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("dialog_accept") { req in
            let appName = req.paramString("app")
            let (result, error) = Dialog.respond(action: "accept", appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("dialog_cancel") { req in
            let appName = req.paramString("app")
            let (result, error) = Dialog.respond(action: "cancel", appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }

        register("dialog_file") { req in
            guard let path = req.paramString("path") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Missing path parameter")
            }
            let appName = req.paramString("app")
            let (result, error) = Dialog.fileDialog(path: path, appName: appName)
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Drag Methods

    private func registerDragMethods() {
        register("drag") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let fromRef = req.paramString("from_ref")
            let fromX = req.paramDouble("from_x")
            let fromY = req.paramDouble("from_y")
            let toRef = req.paramString("to_ref")
            let toX = req.paramDouble("to_x")
            let toY = req.paramDouble("to_y")
            let duration = req.paramDouble("duration") ?? 0.5
            let steps = req.paramInt("steps") ?? 20

            let (result, error) = Drag.drag(
                fromRef: fromRef, fromX: fromX, fromY: fromY,
                toRef: toRef, toX: toX, toY: toY,
                duration: duration, steps: steps,
                refMap: self.lastRefMap
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Batch Methods

    private func registerBatchMethods() {
        register("batch") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }

            guard let commandsRaw = req.params?["commands"]?.value as? [Any] else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams,
                              message: "Missing commands array")
            }

            // Parse commands array: each element should be an array [method, ...args]
            var commands: [[Any]] = []
            for item in commandsRaw {
                if let arr = item as? [Any] {
                    commands.append(arr)
                } else {
                    return .error(id: req.id, code: RPCErrorCode.invalidParams,
                                  message: "Each command must be an array")
                }
            }

            let stopOnError = req.paramBool("stop_on_error") ?? true

            let (result, error) = Batch.execute(
                commands: commands,
                stopOnError: stopOnError,
                dispatcher: self
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Diff Methods

    private func registerDiffMethods() {
        register("changed") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let appName = req.paramString("app")
            let (result, error) = Diff.changed(
                windowRef: nil, appName: appName,
                windowManager: self.windowManager,
                snapshotBuilder: self.snapshotBuilder,
                grabbedWindow: self.grabbedWindow,
                lastSnapshotData: self.lastSnapshotData
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            // Update stored snapshot to the new one
            self.lastRefMap = self.snapshotBuilder.getRefMap()
            return .success(id: req.id, result: result!)
        }

        register("diff") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            let appName = req.paramString("app")
            let (result, error) = Diff.diff(
                windowRef: nil, appName: appName,
                windowManager: self.windowManager,
                snapshotBuilder: self.snapshotBuilder,
                grabbedWindow: self.grabbedWindow,
                lastSnapshotData: self.lastSnapshotData
            )
            if let error = error {
                return .error(id: req.id, code: error.error?.code ?? -32600,
                              message: error.error?.message ?? "Unknown error")
            }
            // Update stored snapshot
            self.lastRefMap = self.snapshotBuilder.getRefMap()
            return .success(id: req.id, result: result!)
        }
    }

    // MARK: - Human-Like Methods

    private func registerHumanLikeMethods() {
        register("human_click") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            guard let ref = req.paramString("ref") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing ref parameter")
            }
            guard let element = self.lastRefMap[ref] else {
                return .error(id: req.id, code: RPCErrorCode.elementNotFound,
                              message: "Element not found: \(ref). Take a snapshot first.")
            }
            let jitter = req.paramDouble("jitter") ?? 3.0
            HumanLike.humanClick(element: element, jitterPixels: jitter)
            return .success(id: req.id, result: ["ok": true, "ref": ref, "human": true])
        }

        register("human_type") { req in
            guard let text = req.paramString("text") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing text parameter")
            }
            let delay = req.paramInt("delay") ?? 50
            HumanLike.humanType(text: text, baseDelay: delay)
            return .success(id: req.id, result: ["ok": true, "length": text.count, "human": true])
        }

        register("human_move") { req in
            guard let x = req.paramDouble("x"), let y = req.paramDouble("y") else {
                return .error(id: req.id, code: RPCErrorCode.invalidParams, message: "Missing x or y coordinate")
            }
            let duration = req.paramDouble("duration") ?? 0.5
            HumanLike.curvedMouseMove(to: CGPoint(x: x, y: y), duration: duration)
            return .success(id: req.id, result: ["ok": true])
        }
    }

    func register(_ method: String, handler: @escaping MethodHandler) {
        handlers[method] = handler
    }

    func dispatch(_ request: RPCRequest) -> RPCResponse {
        guard let handler = handlers[request.method] else {
            return .error(
                id: request.id,
                code: RPCErrorCode.methodNotFound,
                message: "Method not found: \(request.method)"
            )
        }
        return handler(request)
    }

    func hasMethod(_ name: String) -> Bool {
        return handlers[name] != nil
    }

    var registeredMethods: [String] {
        return Array(handlers.keys).sorted()
    }
}
