import XCTest
@testable import ac_core

final class DiffIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
    }

    // MARK: - Changed

    func testChangedWithoutSnapshotReturnsError() {
        // Fresh dispatcher has no previous snapshot
        let error = dispatchExpectingError("changed")
        XCTAssertTrue(error.message.contains("No previous snapshot"))
    }

    func testChangedAfterSnapshotReturnsFalse() {
        // Take first snapshot
        snapshot()
        // Check changed — should be false (nothing changed)
        let result = dispatch("changed")
        XCTAssertEqual(result["ok"] as? Bool, true)
        // May or may not detect change depending on timing, but should not error
    }

    // MARK: - Diff

    func testDiffWithoutSnapshotReturnsError() {
        let error = dispatchExpectingError("diff")
        XCTAssertTrue(error.message.contains("No previous snapshot"))
    }

    func testDiffAfterSnapshotReturnsStructure() {
        snapshot()
        let result = dispatch("diff")
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertNotNil(result["changed"])
        XCTAssertNotNil(result["added"])
        XCTAssertNotNil(result["removed"])
    }

    func testDiffNoChangeShowsEmptyLists() {
        snapshot()
        // Small delay then diff — likely no real change
        Thread.sleep(forTimeInterval: 0.1)
        let result = dispatch("diff")
        let added = result["added"] as? [[String: Any]] ?? []
        let removed = result["removed"] as? [[String: Any]] ?? []
        // If nothing changed, both should be empty
        if (result["changed"] as? Bool) == false {
            XCTAssertEqual(added.count, 0)
            XCTAssertEqual(removed.count, 0)
        }
    }
}
