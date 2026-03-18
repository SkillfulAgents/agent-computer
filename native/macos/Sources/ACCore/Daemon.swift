import Foundation

// MARK: - Unix Domain Socket Daemon Server

class DaemonServer {
    let socketPath: String
    let dispatcher: Dispatcher
    private var serverFD: Int32 = -1
    private var shouldShutdown = false
    private let acDir: String

    init(dispatcher: Dispatcher) {
        self.dispatcher = dispatcher
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.acDir = "\(home)/.ac"
        self.socketPath = "\(acDir)/daemon.sock"
    }

    func start() throws {
        // Create .ac directory
        try FileManager.default.createDirectory(atPath: acDir, withIntermediateDirectories: true)

        // Remove stale socket
        if FileManager.default.fileExists(atPath: socketPath) {
            try FileManager.default.removeItem(atPath: socketPath)
        }

        // Create Unix domain socket
        serverFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard serverFD >= 0 else {
            throw DaemonError.socketCreationFailed(errno)
        }

        // Bind to socket path
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let pathBytes = socketPath.utf8CString
        guard pathBytes.count <= MemoryLayout.size(ofValue: addr.sun_path) else {
            throw DaemonError.socketPathTooLong(socketPath)
        }
        withUnsafeMutablePointer(to: &addr.sun_path) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: pathBytes.count) { dest in
                for i in 0..<pathBytes.count {
                    dest[i] = pathBytes[i]
                }
            }
        }

        let bindResult = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
                bind(serverFD, sockPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bindResult == 0 else {
            close(serverFD)
            throw DaemonError.bindFailed(errno)
        }

        // Set socket file permissions to owner-only
        chmod(socketPath, 0o700)

        // Listen
        guard listen(serverFD, 5) == 0 else {
            close(serverFD)
            throw DaemonError.listenFailed(errno)
        }

        // Write daemon.json
        writeDaemonInfo()

        // Set socket to non-blocking for accept loop
        let flags = fcntl(serverFD, F_GETFL)
        _ = fcntl(serverFD, F_SETFL, flags | O_NONBLOCK)

        log("Daemon listening on \(socketPath)")

        // Accept loop
        runAcceptLoop()

        // Cleanup
        cleanup()
    }

    private func runAcceptLoop() {
        while !shouldShutdown {
            var clientAddr = sockaddr_un()
            var clientLen = socklen_t(MemoryLayout<sockaddr_un>.size)

            let clientFD = withUnsafeMutablePointer(to: &clientAddr) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockPtr in
                    accept(serverFD, sockPtr, &clientLen)
                }
            }

            if clientFD >= 0 {
                // Handle client in a background thread
                DispatchQueue.global(qos: .userInteractive).async { [weak self] in
                    self?.handleClient(fd: clientFD)
                }
            } else if errno == EAGAIN || errno == EWOULDBLOCK {
                // No pending connections — sleep briefly
                Thread.sleep(forTimeInterval: 0.01)
            } else {
                // Accept error
                log("Accept error: \(errno)")
                Thread.sleep(forTimeInterval: 0.1)
            }
        }
    }

    private func handleClient(fd: Int32) {
        let fileHandle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        var buffer = Data()

        // Read until connection closes
        while !shouldShutdown {
            let chunk = fileHandle.availableData
            if chunk.isEmpty {
                break // Connection closed
            }
            buffer.append(chunk)

            // Process newline-delimited JSON messages
            while let newlineIndex = buffer.firstIndex(of: UInt8(ascii: "\n")) {
                let lineData = buffer[buffer.startIndex..<newlineIndex]
                buffer = Data(buffer[(newlineIndex + 1)...])

                guard let line = String(data: lineData, encoding: .utf8), !line.isEmpty else {
                    continue
                }

                if let request = parseRPCRequestFromLine(line) {
                    let response = dispatcher.dispatch(request)

                    if let responseData = response.toJSON() {
                        var output = responseData
                        output.append(UInt8(ascii: "\n"))
                        fileHandle.write(output)
                    }

                    // Check for shutdown
                    if request.method == "shutdown" {
                        shouldShutdown = true
                    }
                } else {
                    // Malformed JSON — send parse error
                    let errResponse = RPCResponse.error(
                        id: 0,
                        code: RPCErrorCode.invalidRequest,
                        message: "Parse error: invalid JSON"
                    )
                    if let data = errResponse.toJSON() {
                        var output = data
                        output.append(UInt8(ascii: "\n"))
                        fileHandle.write(output)
                    }
                }
            }
        }
    }

    private func writeDaemonInfo() {
        let info: [String: Any] = [
            "pid": ProcessInfo.processInfo.processIdentifier,
            "socket": socketPath,
            "started_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let data = try? JSONSerialization.data(withJSONObject: info, options: [.prettyPrinted, .sortedKeys]) {
            let path = "\(acDir)/daemon.json"
            FileManager.default.createFile(atPath: path, contents: data)
        }
    }

    private func cleanup() {
        log("Daemon shutting down")
        close(serverFD)
        try? FileManager.default.removeItem(atPath: socketPath)
        try? FileManager.default.removeItem(atPath: "\(acDir)/daemon.json")
    }

    func requestShutdown() {
        shouldShutdown = true
    }
}

// MARK: - Errors

enum DaemonError: Error, CustomStringConvertible {
    case socketCreationFailed(Int32)
    case socketPathTooLong(String)
    case bindFailed(Int32)
    case listenFailed(Int32)

    var description: String {
        switch self {
        case .socketCreationFailed(let code): return "Failed to create socket (errno \(code))"
        case .socketPathTooLong(let path): return "Socket path too long: \(path)"
        case .bindFailed(let code): return "Failed to bind socket (errno \(code))"
        case .listenFailed(let code): return "Failed to listen on socket (errno \(code))"
        }
    }
}

// MARK: - Logging

private func log(_ message: String) {
    FileHandle.standardError.write(Data("[ac-core] \(message)\n".utf8))
}
