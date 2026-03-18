import Foundation

// MARK: - Method Dispatcher

typealias MethodHandler = (RPCRequest) -> RPCResponse

class Dispatcher {
    private var handlers: [String: MethodHandler] = [:]
    private let startTime = Date()

    // Session state
    var grabbedWindow: String? = nil
    var lastSnapshotId: String? = nil

    init() {
        registerBuiltinMethods()
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
