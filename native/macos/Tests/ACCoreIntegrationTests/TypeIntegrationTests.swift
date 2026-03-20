import XCTest
@testable import ac_core

final class TypeIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
        snapshot()
    }

    // MARK: - Type

    func testTypeReturnsOk() {
        let result = dispatch("type", params: ["text": "hello"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["length"] as? Int, 5)
    }

    func testTypeEmptyText() {
        let result = dispatch("type", params: ["text": ""])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["length"] as? Int, 0)
    }

    func testTypeWithDelay() {
        let start = Date()
        let result = dispatch("type", params: ["text": "ab", "delay": 50])
        let elapsed = Date().timeIntervalSince(start) * 1000
        XCTAssertEqual(result["ok"] as? Bool, true)
        // With 2 chars and 50ms delay, should take at least 50ms
        XCTAssertGreaterThanOrEqual(elapsed, 30)
    }

    // MARK: - Fill

    func testFillTextFieldByRef() {
        // Take snapshot to find a text field
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []

        guard let textField = elements.first(where: { ($0["role"] as? String) == "textfield" }) else {
            return // Skip: No text field found in TestApp snapshot
        }

        let ref = textField["ref"] as! String
        let fillResult = dispatch("fill", params: ["ref": ref, "text": "Integration Test"])
        XCTAssertEqual(fillResult["ok"] as? Bool, true)
        XCTAssertEqual(fillResult["ref"] as? String, ref)
    }

    func testFillNonexistentRefReturnsError() {
        let error = dispatchExpectingError("fill", params: ["ref": "@t9999", "text": "hello"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Key

    func testKeyEscape() {
        let result = dispatch("key", params: ["combo": "escape"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["combo"] as? String, "escape")
    }

    func testKeyWithModifiers() {
        // cmd+a is select all — shouldn't cause issues
        let result = dispatch("key", params: ["combo": "cmd+a"])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    func testKeyRepeat() {
        let result = dispatch("key", params: ["combo": "escape", "repeat": 3])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 3)
    }

    // MARK: - Keydown / Keyup

    func testKeydownKeyup() {
        let downResult = dispatch("keydown", params: ["key": "shift"])
        XCTAssertEqual(downResult["ok"] as? Bool, true)
        XCTAssertEqual(downResult["action"] as? String, "down")

        let upResult = dispatch("keyup", params: ["key": "shift"])
        XCTAssertEqual(upResult["ok"] as? Bool, true)
        XCTAssertEqual(upResult["action"] as? String, "up")
    }

    // MARK: - Paste

    func testPaste() {
        let result = dispatch("paste", params: ["text": "pasted text"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["length"] as? Int, 11)
    }
}
