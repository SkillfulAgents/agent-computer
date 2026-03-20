import XCTest
@testable import ac_core

final class WaitIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
    }

    // MARK: - Wait Fixed Duration

    func testWaitMs() {
        let start = Date()
        let result = dispatch("wait", params: ["ms": 200])
        let elapsed = Date().timeIntervalSince(start) * 1000
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["waited_ms"] as? Int, 200)
        XCTAssertGreaterThanOrEqual(elapsed, 150) // Allow some tolerance
    }

    func testWaitMsZero() {
        let result = dispatch("wait", params: ["ms": 0])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    // MARK: - Wait for App

    func testWaitForRunningApp() {
        // ACTestApp should already be running
        let result = dispatch("wait", params: ["app": "ACTestApp", "timeout": 2000])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["app"] as? String, "ACTestApp")
        XCTAssertNotNil(result["pid"])
    }

    func testWaitForNonexistentAppTimesOut() {
        let error = dispatchExpectingError("wait", params: ["app": "NonExistentApp12345", "timeout": 500])
        XCTAssertEqual(error.code, RPCErrorCode.timeout)
    }

    // MARK: - Wait for Text

    func testWaitForVisibleText() {
        // "Buttons" should be visible in the TestApp
        let result = dispatch("wait", params: ["text": "Buttons", "timeout": 3000])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["state"] as? String, "found")
    }

    func testWaitForNonexistentTextTimesOut() {
        let error = dispatchExpectingError("wait", params: ["text": "ZZZZNONEXISTENT12345", "timeout": 500])
        XCTAssertEqual(error.code, RPCErrorCode.timeout)
    }

    // MARK: - Wait for Window

    func testWaitForExistingWindow() {
        let result = dispatch("wait", params: ["window": "ACTestApp", "timeout": 3000])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    func testWaitForNonexistentWindowTimesOut() {
        let error = dispatchExpectingError("wait", params: ["window": "NonExistentWindow12345", "timeout": 500])
        XCTAssertEqual(error.code, RPCErrorCode.timeout)
    }

    // MARK: - Wait for Element

    func testWaitForHiddenElementSucceedsWhenAbsent() {
        // Element @z9999 doesn't exist, so waiting for it to be hidden should succeed immediately
        snapshot()
        let result = dispatch("wait", params: ["ref": "@z9999", "hidden": true, "timeout": 1000])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["state"] as? String, "hidden")
    }

    func testWaitForNonexistentElementTimesOut() {
        snapshot()
        let error = dispatchExpectingError("wait", params: ["ref": "@z9999", "timeout": 500])
        XCTAssertEqual(error.code, RPCErrorCode.timeout)
    }
}
