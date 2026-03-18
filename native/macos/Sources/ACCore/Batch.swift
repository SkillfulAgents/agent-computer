import Foundation

// MARK: - Batch Command Execution

class Batch {

    /// Execute a sequence of commands, returning results for each
    static func execute(
        commands: [[Any]],
        stopOnError: Bool,
        dispatcher: Dispatcher
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard !commands.isEmpty else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidParams,
                message: "Empty command list"))
        }

        var results: [[String: Any]] = []
        var failed = false

        for (index, cmd) in commands.enumerated() {
            guard let method = cmd.first as? String else {
                let err: [String: Any] = ["index": index, "error": "Invalid command format: first element must be method name"]
                results.append(err)
                if stopOnError { failed = true; break }
                continue
            }

            // Build params from remaining elements
            var params: [String: AnyCodable] = [:]

            // If the command has a second element that's a dict, use it as params
            if cmd.count >= 2 {
                if let paramDict = cmd[1] as? [String: Any] {
                    for (key, value) in paramDict {
                        params[key] = AnyCodable(value)
                    }
                } else {
                    // Treat remaining elements as positional args
                    let positional = Array(cmd.dropFirst())
                    params["_positional"] = AnyCodable(positional)

                    // For common patterns, map positional args to named params
                    mapPositionalParams(method: method, positional: positional, params: &params)
                }
            }

            let request = RPCRequest(
                jsonrpc: "2.0",
                id: index,
                method: method,
                params: params.isEmpty ? nil : params
            )

            let response = dispatcher.dispatch(request)

            if let error = response.error {
                let err: [String: Any] = [
                    "index": index,
                    "method": method,
                    "error": error.message,
                    "code": error.code
                ]
                results.append(err)
                if stopOnError { failed = true; break }
            } else {
                var entry: [String: Any] = ["index": index, "method": method]
                if let result = response.result {
                    entry["result"] = result
                }
                results.append(entry)
            }
        }

        return ([
            "ok": !failed,
            "count": results.count,
            "total": commands.count,
            "results": results
        ] as [String: Any], nil)
    }

    /// Map positional arguments to named parameters for common methods
    private static func mapPositionalParams(method: String, positional: [Any], params: inout [String: AnyCodable]) {
        switch method {
        case "click", "focus", "check", "uncheck", "read", "box", "children":
            if let ref = positional.first as? String {
                params["ref"] = AnyCodable(ref)
            }
        case "type", "paste":
            if let text = positional.first as? String {
                params["text"] = AnyCodable(text)
            }
        case "fill":
            if positional.count >= 2, let ref = positional[0] as? String, let text = positional[1] as? String {
                params["ref"] = AnyCodable(ref)
                params["text"] = AnyCodable(text)
            }
        case "key":
            if let combo = positional.first as? String {
                params["combo"] = AnyCodable(combo)
            }
        case "launch", "quit", "switch", "hide", "unhide":
            if let name = positional.first as? String {
                params["name"] = AnyCodable(name)
            }
        case "menu_click":
            if let path = positional.first as? String {
                params["path"] = AnyCodable(path)
            }
        case "wait":
            if let ms = positional.first as? Int {
                params["ms"] = AnyCodable(ms)
            }
        case "scroll":
            if let dir = positional.first as? String {
                params["direction"] = AnyCodable(dir)
            }
        default:
            break
        }
    }
}
