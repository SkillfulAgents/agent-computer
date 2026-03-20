import XCTest
@testable import ac_core

/// Unit tests for Keyboard — only tests validation and error paths.
/// Tests that post real CGEvents are in ACCoreIntegrationTests (targeting TestApp).
final class KeyboardTests: XCTestCase {

    // MARK: - keyUpDown error paths

    func testKeyUpDownUnknownKeyReturnsError() {
        let (result, error) = Keyboard.keyUpDown(key: "nonexistent_key_xyz", down: true)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(error?.error?.message.contains("Unknown key") ?? false)
    }

    func testKeyUpDownUnknownKeyReturnsErrorUp() {
        let (result, error) = Keyboard.keyUpDown(key: "nonexistent_key_xyz", down: false)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
    }

    // MARK: - fill (element not found)

    func testFillElementNotFound() {
        let (result, error) = Keyboard.fill(ref: "@t99", text: "hello", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testFillElementNotFoundMessage() {
        let (_, error) = Keyboard.fill(ref: "@t42", text: "hello", refMap: [:])
        XCTAssertTrue(error?.error?.message.contains("@t42") ?? false)
    }

    // MARK: - typeText return structure (empty string — no events posted)

    func testTypeTextEmptyString() {
        let (result, error) = Keyboard.typeText(text: "", delay: nil)
        XCTAssertNil(error)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["length"] as? Int, 0)
    }
}
