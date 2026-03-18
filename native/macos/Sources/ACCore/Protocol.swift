import Foundation

// MARK: - JSON-RPC 2.0 Protocol Types

struct RPCRequest: Codable {
    let jsonrpc: String
    let id: Int
    let method: String
    let params: [String: AnyCodable]?

    func param<T>(_ key: String) -> T? {
        return params?[key]?.value as? T
    }

    func paramString(_ key: String) -> String? {
        return params?[key]?.value as? String
    }

    func paramInt(_ key: String) -> Int? {
        return params?[key]?.value as? Int
    }

    func paramBool(_ key: String) -> Bool? {
        return params?[key]?.value as? Bool
    }

    func paramDouble(_ key: String) -> Double? {
        if let d = params?[key]?.value as? Double { return d }
        if let i = params?[key]?.value as? Int { return Double(i) }
        return nil
    }

    func paramStringArray(_ key: String) -> [String]? {
        if let arr = params?[key]?.value as? [Any] {
            return arr.compactMap { $0 as? String }
        }
        return nil
    }
}

struct RPCResponse {
    let jsonrpc: String = "2.0"
    let id: Int
    let result: Any?
    let error: RPCErrorData?

    static func success(id: Int, result: Any) -> RPCResponse {
        return RPCResponse(id: id, result: result, error: nil)
    }

    static func error(id: Int, code: Int, message: String, data: [String: Any]? = nil) -> RPCResponse {
        return RPCResponse(id: id, result: nil, error: RPCErrorData(code: code, message: message, data: data))
    }

    func toJSON() -> Data? {
        var dict: [String: Any] = ["jsonrpc": "2.0", "id": id]
        if let error = error {
            var errDict: [String: Any] = ["code": error.code, "message": error.message]
            if let data = error.data {
                errDict["data"] = data
            }
            dict["error"] = errDict
        } else if let result = result {
            dict["result"] = result
        } else {
            dict["result"] = NSNull()
        }
        return try? JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys])
    }
}

struct RPCErrorData {
    let code: Int
    let message: String
    let data: [String: Any]?
}

// MARK: - Error Codes
enum RPCErrorCode {
    static let elementNotFound = -32001
    static let permissionDenied = -32002
    static let timeout = -32003
    static let appNotFound = -32004
    static let windowNotFound = -32005
    static let invalidRef = -32006
    static let ocrFallbackFailed = -32007
    static let invalidRequest = -32600
    static let methodNotFound = -32601
    static let invalidParams = -32602
}

// MARK: - AnyCodable (for decoding arbitrary JSON)

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON type")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, .init(codingPath: encoder.codingPath, debugDescription: "Unsupported type"))
        }
    }
}

// MARK: - JSON Parsing Helpers

func parseRPCRequest(from data: Data) -> RPCRequest? {
    return try? JSONDecoder().decode(RPCRequest.self, from: data)
}

func parseRPCRequestFromLine(_ line: String) -> RPCRequest? {
    guard let data = line.data(using: .utf8) else { return nil }
    return parseRPCRequest(from: data)
}
