import Foundation
import AppKit

// ac-core — Agent Computer native binary for macOS

let args = CommandLine.arguments

// --version flag
if args.contains("--version") {
    print("0.1.0")
    exit(0)
}

// --daemon flag: start daemon server
if args.contains("--daemon") {
    // Initialize NSApplication so the daemon can create overlay windows (no dock icon)
    NSApplication.shared.setActivationPolicy(.accessory)

    let dispatcher = Dispatcher()
    let server = DaemonServer(dispatcher: dispatcher)
    do {
        try server.start()
    } catch {
        FileHandle.standardError.write(Data("[ac-core] Daemon error: \(error)\n".utf8))
        exit(1)
    }
    exit(0)
}

// One-shot mode: read a JSON-RPC request from stdin, execute, print response to stdout
// If args contain a method name, construct a request from CLI args
if args.count > 1 {
    let method = args[1]
    let dispatcher = Dispatcher()

    // Build a simple request from CLI args
    let requestId = 1
    var params: [String: Any] = [:]

    // Parse remaining args as simple key=value pairs or flags
    var i = 2
    while i < args.count {
        let arg = args[i]
        if arg.hasPrefix("--") {
            let key = String(arg.dropFirst(2))
            // Check if next arg is a value (not another flag)
            if i + 1 < args.count && !args[i + 1].hasPrefix("--") {
                params[key] = args[i + 1]
                i += 2
            } else {
                params[key] = true
                i += 1
            }
        } else {
            // Positional arg
            if params["_positional"] == nil {
                params["_positional"] = [String]()
            }
            if var positional = params["_positional"] as? [String] {
                positional.append(arg)
                params["_positional"] = positional
            }
            i += 1
        }
    }

    let request = RPCRequest(
        jsonrpc: "2.0",
        id: requestId,
        method: method,
        params: params.isEmpty ? nil : params.mapValues { AnyCodable($0) }
    )

    let response = dispatcher.dispatch(request)

    if let data = response.toJSON(), let str = String(data: data, encoding: .utf8) {
        print(str)
    }

    // Exit with appropriate code
    if let error = response.error {
        switch error.code {
        case RPCErrorCode.elementNotFound: exit(1)
        case RPCErrorCode.permissionDenied: exit(2)
        case RPCErrorCode.timeout: exit(3)
        case RPCErrorCode.appNotFound: exit(4)
        case RPCErrorCode.windowNotFound: exit(5)
        case RPCErrorCode.invalidRef: exit(6)
        case RPCErrorCode.ocrFallbackFailed: exit(7)
        default: exit(126)
        }
    }

    exit(0)
}

// No args: read JSON-RPC from stdin (pipe mode)
let dispatcher = Dispatcher()
if let inputData = FileHandle.standardInput.availableData as Data?,
   !inputData.isEmpty,
   let request = parseRPCRequest(from: inputData) {
    let response = dispatcher.dispatch(request)
    if let data = response.toJSON(), let str = String(data: data, encoding: .utf8) {
        print(str)
    }
} else {
    // No input — print usage
    FileHandle.standardError.write(Data("Usage: ac-core [--daemon | --version | <method> [args...]]\n".utf8))
    FileHandle.standardError.write(Data("  --daemon    Start daemon server (Unix socket)\n".utf8))
    FileHandle.standardError.write(Data("  --version   Print version\n".utf8))
    FileHandle.standardError.write(Data("  <method>    Execute a single JSON-RPC method\n".utf8))
    FileHandle.standardError.write(Data("  (stdin)     Read JSON-RPC request from stdin\n".utf8))
    exit(0)
}
