import XCTest
@testable import ac_core

final class ReadIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
        snapshot()
    }

    // MARK: - Read Element

    func testReadButtonElement() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []

        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }

        let ref = button["ref"] as! String
        let readResult = dispatch("read", params: ["ref": ref])
        XCTAssertEqual(readResult["ok"] as? Bool, true)
        XCTAssertEqual(readResult["ref"] as? String, ref)
        XCTAssertNotNil(readResult["role"])
    }

    func testReadNonexistentRefReturnsError() {
        let error = dispatchExpectingError("read", params: ["ref": "@x9999"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Title

    func testTitleReturnsAppName() {
        let result = dispatch("title", params: ["app": true])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertNotNil(result["title"])
    }

    func testTitleWindowMode() {
        let result = dispatch("title")
        XCTAssertEqual(result["ok"] as? Bool, true)
        // Should return the grabbed window's title
        XCTAssertNotNil(result["title"])
    }

    // MARK: - Is (State Check)

    func testIsVisibleElement() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }

        let ref = button["ref"] as! String
        let result = dispatch("is", params: ["ref": ref, "state": "visible"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["state"] as? String, "visible")
        // Visible buttons should report true
        XCTAssertEqual(result["value"] as? Bool, true)
    }

    func testIsEnabledElement() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: {
            ($0["role"] as? String) == "button" && ($0["enabled"] as? Bool) == true
        }) else {
            return // Skip: No enabled button found
        }

        let ref = button["ref"] as! String
        let result = dispatch("is", params: ["ref": ref, "state": "enabled"])
        XCTAssertEqual(result["value"] as? Bool, true)
    }

    func testIsUnknownStateReturnsError() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []
        guard let el = elements.first else {
            return // Skip: No elements found
        }
        let ref = el["ref"] as! String
        let error = dispatchExpectingError("is", params: ["ref": ref, "state": "dancing"])
        XCTAssertEqual(error.code, RPCErrorCode.invalidParams)
    }

    // MARK: - Box

    func testBoxReturnsValidBounds() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []
        guard let button = elements.first(where: { ($0["role"] as? String) == "button" }) else {
            return // Skip: No button found
        }

        let ref = button["ref"] as! String
        let result = dispatch("box", params: ["ref": ref])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let bounds = result["bounds"] as? [Double]
        XCTAssertNotNil(bounds)
        XCTAssertEqual(bounds?.count, 4)
    }

    // MARK: - Children

    func testChildrenReturnsArray() {
        let snapResult = snapshot(compact: true)
        let elements = snapResult["elements"] as? [[String: Any]] ?? []
        guard let group = elements.first(where: { ($0["role"] as? String) == "group" }) else {
            // Try any element
            guard let any = elements.first else {
                return // Skip: No elements found
            }
            let ref = any["ref"] as! String
            let result = dispatch("children", params: ["ref": ref])
            XCTAssertEqual(result["ok"] as? Bool, true)
            XCTAssertNotNil(result["children"])
            return
        }

        let ref = group["ref"] as! String
        let result = dispatch("children", params: ["ref": ref])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertNotNil(result["children"])
        XCTAssertNotNil(result["count"])
    }
}
