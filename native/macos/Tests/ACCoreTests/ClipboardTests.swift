import XCTest
@testable import ac_core

final class ClipboardTests: XCTestCase {

    // MARK: - Read

    func testClipboardReadReturnsOk() {
        let (result, error) = ClipboardManager.read()
        XCTAssertNil(error)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        // text may be nil if clipboard is empty, which is fine
    }

    // MARK: - Set and Read Round-Trip

    func testClipboardSetAndRead() {
        let testText = "ac-core-test-\(UUID().uuidString)"
        let (setResult, setError) = ClipboardManager.set(text: testText)
        XCTAssertNil(setError)
        XCTAssertEqual(setResult?["ok"] as? Bool, true)

        let (readResult, readError) = ClipboardManager.read()
        XCTAssertNil(readError)
        XCTAssertEqual(readResult?["text"] as? String, testText)
    }

    func testClipboardSetEmptyString() {
        let (result, error) = ClipboardManager.set(text: "")
        XCTAssertNil(error)
        XCTAssertEqual(result?["ok"] as? Bool, true)

        let (readResult, _) = ClipboardManager.read()
        XCTAssertEqual(readResult?["text"] as? String, "")
    }

    func testClipboardSetOverwritesPrevious() {
        _ = ClipboardManager.set(text: "first")
        _ = ClipboardManager.set(text: "second")

        let (readResult, _) = ClipboardManager.read()
        XCTAssertEqual(readResult?["text"] as? String, "second")
    }

    func testClipboardSetUnicode() {
        let testText = "Hello 世界 🌍"
        _ = ClipboardManager.set(text: testText)
        let (readResult, _) = ClipboardManager.read()
        XCTAssertEqual(readResult?["text"] as? String, testText)
    }
}
