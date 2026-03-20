import XCTest
@testable import ac_core

final class DispatcherTests: XCTestCase {

    // MARK: - Builtin Methods

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
        XCTAssertNotNil(result?["accessibility"])
        XCTAssertNotNil(result?["screen_recording"])
    }

    // MARK: - Method Registration

    func testRegisteredMethods() throws {
        let dispatcher = Dispatcher()
        let methods = dispatcher.registeredMethods

        // Verify all expected methods are registered
        let expectedMethods = [
            // Builtin
            "ping", "status", "version", "shutdown", "permissions", "permissions_grant",
            // Apps
            "apps", "launch", "quit", "hide", "unhide", "switch",
            // Windows
            "windows", "grab", "ungrab", "minimize", "maximize", "fullscreen",
            "close", "raise", "move", "resize", "bounds",
            // Snapshot
            "snapshot",
            // Actions
            "click", "hover", "mouse",
            // Keyboard
            "type", "fill", "key", "keydown", "keyup", "paste",
            // Clipboard
            "clipboard_read", "clipboard_set", "clipboard_copy",
            // Capture
            "screenshot", "displays",
            // Scroll
            "scroll",
            // Focus
            "focus", "select", "check", "uncheck", "set",
            // Find
            "find",
            // Read
            "read", "title", "is", "box", "children",
            // Wait
            "wait",
            // Menu
            "menu_click", "menu_list", "menubar",
            // Dialog
            "dialog", "dialog_accept", "dialog_cancel", "dialog_file",
            // Drag
            "drag",
            // Batch
            "batch",
            // Diff
            "changed", "diff",
            // Human-like
            "human_click", "human_type", "human_move",
        ]

        for method in expectedMethods {
            XCTAssertTrue(methods.contains(method), "Missing method: \(method)")
        }
    }

    func testRegisteredMethodCount() {
        let dispatcher = Dispatcher()
        // Should have at least 50 methods
        XCTAssertGreaterThanOrEqual(dispatcher.registeredMethods.count, 50)
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

    func testHasMethodReturnsFalseForUnknown() {
        let dispatcher = Dispatcher()
        XCTAssertFalse(dispatcher.hasMethod("nonexistent"))
    }

    // MARK: - State Management

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

    func testStatusShowsLastSnapshotId() {
        let dispatcher = Dispatcher()
        dispatcher.lastSnapshotId = "abc12345"
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "status", params: nil)
        let response = dispatcher.dispatch(req)
        let result = response.result as? [String: Any]
        XCTAssertEqual(result?["last_snapshot_id"] as? String, "abc12345")
    }

    func testStatusReportsUptime() throws {
        let dispatcher = Dispatcher()
        // Small sleep to ensure uptime > 0
        Thread.sleep(forTimeInterval: 0.01)
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "status", params: nil)
        let response = dispatcher.dispatch(req)
        let result = response.result as? [String: Any]
        let uptime = result?["daemon_uptime_ms"] as? Int
        XCTAssertNotNil(uptime)
        XCTAssertGreaterThan(uptime!, 0)
    }

    // MARK: - Parameter Validation

    func testTypeMissingTextReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "type", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("text") ?? false)
    }

    func testFillMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["text": AnyCodable("hello")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "fill", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("ref") ?? false)
    }

    func testFillMissingTextReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@t1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "fill", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("text") ?? false)
    }

    func testKeyMissingComboReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "key", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("combo") ?? false)
    }

    func testKeydownMissingKeyReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "keydown", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testKeyupMissingKeyReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "keyup", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testPasteMissingTextReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "paste", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testScrollMissingDirectionReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "scroll", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("direction") ?? false)
    }

    func testFocusMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "focus", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testSelectMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["value": AnyCodable("Red")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "select", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testSelectMissingValueReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@d1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "select", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testCheckMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "check", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testUncheckMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "uncheck", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testSetMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["value": AnyCodable("50")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "set", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testSetMissingValueReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@s1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "set", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testReadMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "read", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testIsMissingStateReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@b1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "is", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testIsMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["state": AnyCodable("visible")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "is", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testBoxMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "box", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testChildrenMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "children", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testFindMissingTextAndRoleReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "find", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testWaitMissingAllParamsReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "wait", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(response.error?.message.contains("wait requires") ?? false)
    }

    func testLaunchMissingNameReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "launch", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testQuitMissingNameReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "quit", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testHideMissingNameReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "hide", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testUnhideMissingNameReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "unhide", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testSwitchMissingNameReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "switch", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testMenuClickMissingPathReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "menu_click", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testDialogFileMissingPathReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "dialog_file", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testGrabMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "grab", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testMinimizeMissingRefAndNoGrabReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "minimize", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testMoveMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["x": AnyCodable(100), "y": AnyCodable(100)]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "move", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testResizeMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["width": AnyCodable(800), "height": AnyCodable(600)]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "resize", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testMouseInvalidActionReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["action": AnyCodable("click"), "button": AnyCodable("left")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "mouse", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testMouseInvalidButtonReturnsError() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["action": AnyCodable("down"), "button": AnyCodable("extra")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "mouse", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testHumanClickMissingRefReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "human_click", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testHumanTypeMissingTextReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "human_type", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    func testHumanMoveMissingCoordsReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "human_move", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    // MARK: - Element Not Found (refMap is empty)

    func testClickWithRefNotFoundReturnsElementNotFound() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@b1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "click", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.elementNotFound)
    }

    func testHumanClickRefNotFoundReturnsElementNotFound() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@b1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "human_click", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.elementNotFound)
    }

    func testReadRefNotFoundReturnsElementNotFound() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@b1")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "read", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.elementNotFound)
    }

    func testFillRefNotFoundReturnsElementNotFound() {
        let dispatcher = Dispatcher()
        let params: [String: AnyCodable] = ["ref": AnyCodable("@t1"), "text": AnyCodable("hello")]
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "fill", params: params)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Ungrab

    func testUngrab() {
        let dispatcher = Dispatcher()
        dispatcher.grabbedWindow = "@w1"
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "ungrab", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNil(response.error)
        XCTAssertNil(dispatcher.grabbedWindow)
    }

    // MARK: - Batch

    func testBatchMissingCommandsReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "batch", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertEqual(response.error?.code, RPCErrorCode.invalidParams)
    }

    // MARK: - Diff / Changed

    func testChangedWithoutSnapshotReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "changed", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertTrue(response.error?.message.contains("No previous snapshot") ?? false)
    }

    func testDiffWithoutSnapshotReturnsError() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 1, method: "diff", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertNotNil(response.error)
        XCTAssertTrue(response.error?.message.contains("No previous snapshot") ?? false)
    }

    // MARK: - Response ID Preservation

    func testDispatchPreservesRequestId() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 42, method: "ping", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertEqual(response.id, 42)
    }

    func testErrorPreservesRequestId() {
        let dispatcher = Dispatcher()
        let req = RPCRequest(jsonrpc: "2.0", id: 99, method: "nonexistent", params: nil)
        let response = dispatcher.dispatch(req)
        XCTAssertEqual(response.id, 99)
    }
}
