import XCTest
@testable import ac_core

final class ProtocolTests: XCTestCase {

    // MARK: - Request Decoding

    func testDecodeSimpleRequest() throws {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"ping","params":{}}
        """
        let request = parseRPCRequestFromLine(json)
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.jsonrpc, "2.0")
        XCTAssertEqual(request?.id, 1)
        XCTAssertEqual(request?.method, "ping")
    }

    func testDecodeRequestWithParams() throws {
        let json = """
        {"jsonrpc":"2.0","id":5,"method":"click","params":{"ref":"@b1","right":true}}
        """
        let request = parseRPCRequestFromLine(json)
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.method, "click")
        XCTAssertEqual(request?.paramString("ref"), "@b1")
        XCTAssertEqual(request?.paramBool("right"), true)
    }

    func testDecodeRequestWithoutParams() throws {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"ping"}
        """
        let request = parseRPCRequestFromLine(json)
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.method, "ping")
        XCTAssertNil(request?.params)
    }

    func testDecodeInvalidJSON() throws {
        let request = parseRPCRequestFromLine("not valid json")
        XCTAssertNil(request)
    }

    func testDecodeEmptyString() throws {
        let request = parseRPCRequestFromLine("")
        XCTAssertNil(request)
    }

    // MARK: - Param Extraction

    func testParamStringMissingKey() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"foo":"bar"}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertNil(request.paramString("nonexistent"))
    }

    func testParamIntExtraction() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"count":42}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertEqual(request.paramInt("count"), 42)
        XCTAssertNil(request.paramInt("missing"))
    }

    func testParamBoolFalseValue() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"flag":false}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertEqual(request.paramBool("flag"), false)
    }

    func testParamBoolMissingReturnsNil() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"other":"value"}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertNil(request.paramBool("flag"))
    }

    func testParamDoubleFromInt() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":10}}
        """
        let request = parseRPCRequestFromLine(json)!
        // paramDouble should coerce Int to Double
        XCTAssertEqual(request.paramDouble("val"), 10.0)
    }

    func testParamDoubleFromDouble() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":3.14}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertEqual(request.paramDouble("val")!, 3.14, accuracy: 0.001)
    }

    func testParamDoubleMissingReturnsNil() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertNil(request.paramDouble("val"))
    }

    func testParamStringArray() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"mods":["cmd","shift"]}}
        """
        let request = parseRPCRequestFromLine(json)!
        let arr = request.paramStringArray("mods")
        XCTAssertEqual(arr, ["cmd", "shift"])
    }

    func testParamStringArrayMissing() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test","params":{}}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertNil(request.paramStringArray("mods"))
    }

    func testParamFromNilParams() {
        let json = """
        {"jsonrpc":"2.0","id":1,"method":"test"}
        """
        let request = parseRPCRequestFromLine(json)!
        XCTAssertNil(request.paramString("any"))
        XCTAssertNil(request.paramInt("any"))
        XCTAssertNil(request.paramBool("any"))
        XCTAssertNil(request.paramDouble("any"))
        XCTAssertNil(request.paramStringArray("any"))
    }

    // MARK: - Response Serialization

    func testResponseSuccessToJSON() throws {
        let response = RPCResponse.success(id: 1, result: ["pong": true])
        let data = response.toJSON()
        XCTAssertNotNil(data)

        let dict = try JSONSerialization.jsonObject(with: data!) as! [String: Any]
        XCTAssertEqual(dict["jsonrpc"] as? String, "2.0")
        XCTAssertEqual(dict["id"] as? Int, 1)
        let result = dict["result"] as? [String: Any]
        XCTAssertEqual(result?["pong"] as? Bool, true)
    }

    func testResponseErrorToJSON() throws {
        let response = RPCResponse.error(id: 2, code: -32601, message: "Method not found")
        let data = response.toJSON()
        XCTAssertNotNil(data)

        let dict = try JSONSerialization.jsonObject(with: data!) as! [String: Any]
        XCTAssertEqual(dict["id"] as? Int, 2)
        let error = dict["error"] as? [String: Any]
        XCTAssertEqual(error?["code"] as? Int, -32601)
        XCTAssertEqual(error?["message"] as? String, "Method not found")
    }

    func testResponseErrorWithData() throws {
        let response = RPCResponse.error(id: 3, code: -32001, message: "Not found", data: ["ref": "@b99"])
        let data = response.toJSON()
        XCTAssertNotNil(data)

        let dict = try JSONSerialization.jsonObject(with: data!) as! [String: Any]
        let error = dict["error"] as? [String: Any]
        let errData = error?["data"] as? [String: Any]
        XCTAssertEqual(errData?["ref"] as? String, "@b99")
    }

    func testResponseErrorWithoutDataOmitsField() throws {
        let response = RPCResponse.error(id: 4, code: -32600, message: "Invalid request")
        let data = response.toJSON()!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let error = dict["error"] as? [String: Any]
        XCTAssertNil(error?["data"])
    }

    func testResponseSuccessWithNilResultSerializesNull() throws {
        // When result is nil and error is nil, should serialize result as null
        let response = RPCResponse(id: 5, result: nil, error: nil)
        let data = response.toJSON()!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertTrue(dict["result"] is NSNull)
    }

    func testResponsePreservesRequestId() throws {
        let response = RPCResponse.success(id: 999, result: ["ok": true])
        let data = response.toJSON()!
        let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(dict["id"] as? Int, 999)
    }

    // MARK: - AnyCodable

    func testAnyCodableDecodeString() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":"hello"}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        XCTAssertEqual(request.params?["val"]?.value as? String, "hello")
    }

    func testAnyCodableDecodeInt() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":42}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        XCTAssertEqual(request.params?["val"]?.value as? Int, 42)
    }

    func testAnyCodableDecodeBool() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":true}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        XCTAssertEqual(request.params?["val"]?.value as? Bool, true)
    }

    func testAnyCodableDecodeNull() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":null}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        XCTAssertTrue(request.params?["val"]?.value is NSNull)
    }

    func testAnyCodableDecodeArray() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":[1,2,3]}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        let arr = request.params?["val"]?.value as? [Any]
        XCTAssertEqual(arr?.count, 3)
        XCTAssertEqual(arr?[0] as? Int, 1)
    }

    func testAnyCodableDecodeNestedDict() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":{"nested":"deep"}}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        let dict = request.params?["val"]?.value as? [String: Any]
        XCTAssertEqual(dict?["nested"] as? String, "deep")
    }

    func testAnyCodableDecodeDouble() throws {
        let json = Data("""
        {"jsonrpc":"2.0","id":1,"method":"test","params":{"val":2.718}}
        """.utf8)
        let request = try JSONDecoder().decode(RPCRequest.self, from: json)
        XCTAssertEqual(request.params?["val"]?.value as? Double, 2.718)
    }

    func testAnyCodableEncodeRoundTrip() throws {
        let original = AnyCodable(["key": "value", "num": 42] as [String: Any])
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: encoded)
        let dict = decoded.value as? [String: Any]
        XCTAssertEqual(dict?["key"] as? String, "value")
    }

    func testAnyCodableEncodeNullRoundTrip() throws {
        let original = AnyCodable(NSNull())
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(AnyCodable.self, from: encoded)
        XCTAssertTrue(decoded.value is NSNull)
    }

    // MARK: - parseRPCRequest from Data

    func testParseRPCRequestFromData() {
        let data = Data("""
        {"jsonrpc":"2.0","id":7,"method":"version","params":{}}
        """.utf8)
        let request = parseRPCRequest(from: data)
        XCTAssertNotNil(request)
        XCTAssertEqual(request?.method, "version")
        XCTAssertEqual(request?.id, 7)
    }

    func testParseRPCRequestFromInvalidData() {
        let data = Data("garbage".utf8)
        let request = parseRPCRequest(from: data)
        XCTAssertNil(request)
    }

    // MARK: - Error Codes

    func testRPCErrorCodeValues() {
        XCTAssertEqual(RPCErrorCode.elementNotFound, -32001)
        XCTAssertEqual(RPCErrorCode.permissionDenied, -32002)
        XCTAssertEqual(RPCErrorCode.timeout, -32003)
        XCTAssertEqual(RPCErrorCode.appNotFound, -32004)
        XCTAssertEqual(RPCErrorCode.windowNotFound, -32005)
        XCTAssertEqual(RPCErrorCode.invalidRef, -32006)
        XCTAssertEqual(RPCErrorCode.invalidRequest, -32600)
        XCTAssertEqual(RPCErrorCode.methodNotFound, -32601)
        XCTAssertEqual(RPCErrorCode.invalidParams, -32602)
    }
}
