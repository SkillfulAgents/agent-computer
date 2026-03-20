import XCTest
@testable import ac_core

final class ClickIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
        snapshot() // Populate ref map
    }

    // MARK: - Click by Ref

    func testClickButtonByRef() {
        // Find a button in the snapshot
        let result = snapshot(compact: true)
        let elements = result["elements"] as? [[String: Any]] ?? []

        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found in TestApp snapshot
        }

        let ref = button["ref"] as! String
        let clickResult = dispatch("click", params: ["ref": ref])
        XCTAssertEqual(clickResult["ok"] as? Bool, true)
        XCTAssertEqual(clickResult["ref"] as? String, ref)
    }

    func testClickReturnsElementNotFoundForInvalidRef() {
        let error = dispatchExpectingError("click", params: ["ref": "@b9999"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Click by Coordinates

    func testClickByCoordinates() {
        let clickResult = dispatch("click", params: ["x": 400.0, "y": 300.0])
        XCTAssertEqual(clickResult["ok"] as? Bool, true)
    }

    // MARK: - Click Modes

    func testDoubleClick() {
        let result = snapshot(compact: true)
        let elements = result["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }
        let ref = button["ref"] as! String
        let clickResult = dispatch("click", params: ["ref": ref, "double": true])
        XCTAssertEqual(clickResult["ok"] as? Bool, true)
    }

    func testClickWithCount() {
        let result = snapshot(compact: true)
        let elements = result["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }
        let ref = button["ref"] as! String
        let clickResult = dispatch("click", params: ["ref": ref, "count": 3])
        XCTAssertEqual(clickResult["ok"] as? Bool, true)
    }

    // MARK: - Hover

    func testHoverByRef() {
        let result = snapshot(compact: true)
        let elements = result["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }
        let ref = button["ref"] as! String
        let hoverResult = dispatch("hover", params: ["ref": ref])
        XCTAssertEqual(hoverResult["ok"] as? Bool, true)
        XCTAssertEqual(hoverResult["ref"] as? String, ref)
    }

    func testHoverByCoordinates() {
        let hoverResult = dispatch("hover", params: ["x": 400.0, "y": 300.0])
        XCTAssertEqual(hoverResult["ok"] as? Bool, true)
    }

    func testHoverReturnsElementNotFoundForInvalidRef() {
        let error = dispatchExpectingError("hover", params: ["ref": "@b9999"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }
}
