import XCTest
@testable import ac_core

/// Base class for integration tests that require the TestApp to be running.
/// These tests need accessibility permissions and a GUI session.
///
/// To run:
/// 1. Build & launch TestApp: cd native/macos/TestApp && swift build && .build/debug/ACTestApp
/// 2. Grant accessibility permissions to the test runner
/// 3. swift test --filter ACCoreIntegrationTests
class IntegrationTestBase: XCTestCase {

    static var dispatcher: Dispatcher!
    static var testAppLaunched = false

    /// Shared dispatcher for all integration tests
    var dispatcher: Dispatcher { Self.dispatcher }

    override class func setUp() {
        super.setUp()
        dispatcher = Dispatcher()
    }

    override class func tearDown() {
        dispatcher = nil
        super.tearDown()
    }

    // MARK: - Helpers

    /// Build an RPCRequest with string params
    func makeRequest(method: String, params: [String: Any]? = nil, id: Int = 1) -> RPCRequest {
        let rpcParams: [String: AnyCodable]?
        if let params = params {
            rpcParams = params.mapValues { AnyCodable($0) }
        } else {
            rpcParams = nil
        }
        return RPCRequest(jsonrpc: "2.0", id: id, method: method, params: rpcParams)
    }

    /// Dispatch a request and return the result (asserts no error)
    @discardableResult
    func dispatch(_ method: String, params: [String: Any]? = nil, id: Int = 1,
                  file: StaticString = #filePath, line: UInt = #line) -> [String: Any] {
        let request = makeRequest(method: method, params: params, id: id)
        let response = dispatcher.dispatch(request)
        if let error = response.error {
            XCTFail("Unexpected error for \(method): \(error.message) (code \(error.code))",
                    file: file, line: line)
            return [:]
        }
        return response.result as? [String: Any] ?? [:]
    }

    /// Dispatch a request expecting an error
    func dispatchExpectingError(_ method: String, params: [String: Any]? = nil,
                                file: StaticString = #filePath, line: UInt = #line) -> RPCErrorData {
        let request = makeRequest(method: method, params: params)
        let response = dispatcher.dispatch(request)
        guard let error = response.error else {
            XCTFail("Expected error for \(method) but got success", file: file, line: line)
            return RPCErrorData(code: 0, message: "unexpected success", data: nil)
        }
        return error
    }

    /// Try to grab the TestApp window. Returns true if successful.
    @discardableResult
    func grabTestApp(file: StaticString = #filePath, line: UInt = #line) -> Bool {
        let request = makeRequest(method: "grab", params: ["app": "ACTestApp"])
        let response = dispatcher.dispatch(request)
        if response.error != nil {
            XCTFail("Could not grab ACTestApp window. Is ACTestApp running?", file: file, line: line)
            return false
        }
        return true
    }

    /// Take a snapshot of the grabbed window
    @discardableResult
    func snapshot(compact: Bool = false, interactive: Bool = false, depth: Int? = nil,
                  file: StaticString = #filePath, line: UInt = #line) -> [String: Any] {
        var params: [String: Any] = ["compact": compact, "interactive": interactive]
        if let depth = depth { params["depth"] = depth }
        return dispatch("snapshot", params: params, file: file, line: line)
    }

    /// Check if ACTestApp is available (running and grabbable)
    /// Skips the test if ACTestApp is not available.
    /// Call from setUp() — if this fails, subsequent test methods will fail at grabTestApp().
    func requireTestApp(file: StaticString = #filePath, line: UInt = #line) {
        let request = makeRequest(method: "grab", params: ["app": "ACTestApp"])
        let response = dispatcher.dispatch(request)
        if response.error != nil {
            // Try waiting briefly for it
            let waitReq = makeRequest(method: "wait", params: ["app": "ACTestApp", "timeout": 2000])
            let waitResp = dispatcher.dispatch(waitReq)
            if waitResp.error != nil {
                XCTFail("ACTestApp is not running. Launch it first to run integration tests.")
                return
            }
            // Retry grab
            let retry = dispatcher.dispatch(request)
            if retry.error != nil {
                XCTFail("ACTestApp window not available. Launch ACTestApp first.")
            }
        }
    }

    /// Read the status file written by TestApp for verification
    func readTestStatus() -> String? {
        let path = "/tmp/ac-test-status.txt"
        return try? String(contentsOfFile: path, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Clear the test status file
    func clearTestStatus() {
        let path = "/tmp/ac-test-status.txt"
        try? "".write(toFile: path, atomically: true, encoding: .utf8)
    }
}
