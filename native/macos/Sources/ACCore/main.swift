import Foundation

// ac-core — Phase 0 stub
// Full implementation in Phase 1

if CommandLine.arguments.contains("--version") {
    print("0.1.0")
} else {
    let response: [String: Any] = [
        "jsonrpc": "2.0",
        "id": 0,
        "result": ["status": "stub"]
    ]
    if let data = try? JSONSerialization.data(withJSONObject: response),
       let str = String(data: data, encoding: .utf8) {
        print(str)
    }
}
