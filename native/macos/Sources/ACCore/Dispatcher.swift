import Foundation
import ApplicationServices

// MARK: - Method Dispatcher

typealias MethodHandler = (RPCRequest) -> RPCResponse

class Dispatcher {
    private var handlers: [String: MethodHandler] = [:]
    private let startTime = Date()

    // Session state
    var grabbedWindow: String? = nil
    var lastSnapshotId: String? = nil

    // Managers
    let windowManager = WindowManager()
    let snapshotBuilder = SnapshotBuilder()
    var lastRefMap: [String: AXUIElement] = [:]

    init() {
        registerBuiltinMethods()
        registerAppMethods()
        registerWindowMethods()
        registerSnapshotMethods()
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
            return .success(id: req.id, result: [
                "grabbed_window": self.grabbedWindow as Any,
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
            let info = self.windowManager.getWindowInfo(ref: ref) ?? [:]
            return .success(id: req.id, result: ["ok": true, "window": info] as [String: Any])
        }

        register("ungrab") { [weak self] req in
            guard let self = self else {
                return .error(id: req.id, code: RPCErrorCode.invalidRequest, message: "Dispatcher deallocated")
            }
            self.grabbedWindow = nil
            return .success(id: req.id, result: ["ok": true])
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

            // Store ref map and snapshot ID for subsequent commands
            self.lastRefMap = self.snapshotBuilder.getRefMap()
            self.lastSnapshotId = result["snapshot_id"] as? String

            return .success(id: req.id, result: result)
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
