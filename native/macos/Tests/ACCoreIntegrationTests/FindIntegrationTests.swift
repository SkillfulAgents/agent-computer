import XCTest
@testable import ac_core

final class FindIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
    }

    // MARK: - Find by Text

    func testFindByText() {
        let result = dispatch("find", params: ["text": "Buttons"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let elements = result["elements"] as? [[String: Any]]
        XCTAssertNotNil(elements)
        XCTAssertGreaterThan(elements?.count ?? 0, 0)
    }

    func testFindByTextCaseInsensitive() {
        let result = dispatch("find", params: ["text": "buttons"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let count = result["count"] as? Int ?? 0
        XCTAssertGreaterThan(count, 0)
    }

    func testFindNonexistentTextReturnsEmpty() {
        let result = dispatch("find", params: ["text": "ZZZZNONEXISTENT12345"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 0)
    }

    // MARK: - Find by Role

    func testFindByRole() {
        let result = dispatch("find", params: ["role": "button"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let elements = result["elements"] as? [[String: Any]] ?? []
        XCTAssertGreaterThan(elements.count, 0)
        // All results should be buttons
        for el in elements {
            XCTAssertEqual(el["role"] as? String, "button")
        }
    }

    // MARK: - Find with First

    func testFindFirstReturnsOneResult() {
        let result = dispatch("find", params: ["role": "button", "first": true])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 1)
        let elements = result["elements"] as? [[String: Any]]
        XCTAssertEqual(elements?.count, 1)
    }

    // MARK: - Find with Combined Text and Role

    func testFindWithTextAndRole() {
        let result = dispatch("find", params: ["text": "Primary", "role": "button"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let elements = result["elements"] as? [[String: Any]] ?? []
        for el in elements {
            XCTAssertEqual(el["role"] as? String, "button")
        }
    }

    // MARK: - Find Updates RefMap

    func testFindUpdatesRefMap() {
        _ = dispatch("find", params: ["role": "button"])
        XCTAssertFalse(dispatcher.lastRefMap.isEmpty, "Find should populate refMap")
    }

    // MARK: - Find Validation

    func testFindMissingTextAndRoleReturnsError() {
        let error = dispatchExpectingError("find")
        XCTAssertEqual(error.code, RPCErrorCode.invalidParams)
    }
}
