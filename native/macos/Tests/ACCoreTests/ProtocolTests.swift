import XCTest
@testable import ac_core

final class ProtocolTests: XCTestCase {

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
}
