import XCTest
@testable import ac_core

final class DispatcherTests: XCTestCase {

    func testPing() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 1, method: "ping", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNil(response.error)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["pong"] as? Bool, true)
    }

    func testStatus() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 2, method: "status", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNil(response.error)
        let result = response.result as? [String: Any]
        XCTAssertNotNil(result?["daemon_pid"])
        XCTAssertNotNil(result?["daemon_uptime_ms"])
    }

    func testVersion() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 3, method: "version", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNil(response.error)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["version"] as? String, "0.1.0")
    }

    func testUnknownMethodReturnsError() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 4, method: "nonexistent", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.methodNotFound)
        XCTAssertTrue(response.error?.message.contains("nonexistent") ?? false)
    }

    func testShutdown() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 5, method: "shutdown", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNil(response.error)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["ok"] as? Bool, true)
    }

    func testPermissions() throws {
        let dispatcher = Dispatcher()
        let request = RPCRequest(jsonrpc: "2.0", id: 6, method: "permissions", params: nil)
        let response = dispatcher.dispatch(request)

        XCTAssertNil(response.error)
        let result = response.result as? [String: Any]
        // These should be booleans regardless of actual permission state
        XCTAssertNotNil(result?["accessibility"])
        XCTAssertNotNil(result?["screen_recording"])
    }

    func testRegisteredMethods() throws {
        let dispatcher = Dispatcher()
        let methods = dispatcher.registeredMethods
        XCTAssertTrue(methods.contains("ping"))
        XCTAssertTrue(methods.contains("status"))
        XCTAssertTrue(methods.contains("version"))
        XCTAssertTrue(methods.contains("shutdown"))
        XCTAssertTrue(methods.contains("permissions"))
        XCTAssertTrue(methods.contains("permissions_grant"))
    }

    func testCustomMethodRegistration() throws {
        let dispatcher = Dispatcher()
        dispatcher.register("custom") { req in
            .success(id: req.id, result: ["custom": true])
        }
        XCTAssertTrue(dispatcher.hasMethod("custom"))

        let request = RPCRequest(jsonrpc: "2.0", id: 10, method: "custom", params: nil)
        let response = dispatcher.dispatch(request)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["custom"] as? Bool, true)
    }

    func testGrabUngrabState() throws {
        let dispatcher = Dispatcher()
        XCTAssertNil(dispatcher.grabbedWindow)

        dispatcher.grabbedWindow = "@w1"
        XCTAssertEqual(dispatcher.grabbedWindow, "@w1")

        let statusReq = RPCRequest(jsonrpc: "2.0", id: 1, method: "status", params: nil)
        let response = dispatcher.dispatch(statusReq)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["grabbed_window"] as? String, "@w1")

        dispatcher.grabbedWindow = nil
        XCTAssertNil(dispatcher.grabbedWindow)
    }
}
