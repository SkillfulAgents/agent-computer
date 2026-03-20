import XCTest
@testable import ac_core

final class SnapshotIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
    }

    // MARK: - Basic Snapshot

    func testSnapshotReturnsValidStructure() {
        grabTestApp()
        let result = snapshot()
        XCTAssertNotNil(result["snapshot_id"])
        XCTAssertNotNil(result["window"])
        XCTAssertNotNil(result["elements"])
    }

    func testSnapshotHasSnapshotId() {
        grabTestApp()
        let result = snapshot()
        let snapshotId = result["snapshot_id"] as? String
        XCTAssertNotNil(snapshotId)
        XCTAssertFalse(snapshotId!.isEmpty)
    }

    func testSnapshotWindowInfo() {
        grabTestApp()
        let result = snapshot()
        let window = result["window"] as? [String: Any]
        XCTAssertNotNil(window)
        XCTAssertEqual(window?["app"] as? String, "ACTestApp")
        XCTAssertNotNil(window?["bounds"])
        XCTAssertNotNil(window?["process_id"])
    }

    func testSnapshotHasElements() {
        grabTestApp()
        let result = snapshot()
        let elements = result["elements"] as? [[String: Any]]
        XCTAssertNotNil(elements)
        XCTAssertGreaterThan(elements?.count ?? 0, 0)
    }

    func testSnapshotElementsHaveRefs() {
        grabTestApp()
        let result = snapshot()
        let elements = result["elements"] as? [[String: Any]] ?? []
        // Check first few elements have refs
        for el in elements.prefix(5) {
            XCTAssertNotNil(el["ref"], "Element should have a ref")
            let ref = el["ref"] as? String ?? ""
            XCTAssertTrue(ref.hasPrefix("@"), "Ref should start with @: \(ref)")
        }
    }

    func testSnapshotElementsHaveRoles() {
        grabTestApp()
        let result = snapshot()
        let elements = result["elements"] as? [[String: Any]] ?? []
        for el in elements.prefix(5) {
            XCTAssertNotNil(el["role"], "Element should have a role")
        }
    }

    // MARK: - Snapshot Modes

    func testSnapshotCompactMode() {
        grabTestApp()
        let normalResult = snapshot(compact: false)
        let compactResult = snapshot(compact: true)

        let normalElements = normalResult["elements"] as? [[String: Any]] ?? []
        let compactElements = compactResult["elements"] as? [[String: Any]] ?? []

        // Compact mode should flatten the tree — no children keys
        for el in compactElements {
            XCTAssertNil(el["children"], "Compact elements should not have children")
        }

        // Compact should generally have more elements (flattened)
        XCTAssertGreaterThanOrEqual(compactElements.count, normalElements.count)
    }

    func testSnapshotInteractiveMode() {
        grabTestApp()
        let fullResult = snapshot(interactive: false)
        let interactiveResult = snapshot(interactive: true)

        let fullElements = flattenAll(fullResult["elements"] as? [[String: Any]] ?? [])
        let interactiveElements = flattenAll(interactiveResult["elements"] as? [[String: Any]] ?? [])

        // Interactive mode should have fewer elements (only interactive ones + containers)
        XCTAssertLessThanOrEqual(interactiveElements.count, fullElements.count)
    }

    func testSnapshotDepthLimiting() {
        grabTestApp()
        let deepResult = snapshot(depth: 50)
        let shallowResult = snapshot(depth: 1)

        let deepElements = flattenAll(deepResult["elements"] as? [[String: Any]] ?? [])
        let shallowElements = flattenAll(shallowResult["elements"] as? [[String: Any]] ?? [])

        // Shallow depth should produce fewer elements
        XCTAssertLessThanOrEqual(shallowElements.count, deepElements.count)
    }

    // MARK: - Snapshot IDs

    func testSnapshotIdsAreUnique() {
        grabTestApp()
        let result1 = snapshot()
        let result2 = snapshot()
        let id1 = result1["snapshot_id"] as? String
        let id2 = result2["snapshot_id"] as? String
        XCTAssertNotEqual(id1, id2, "Each snapshot should get a unique ID")
    }

    // MARK: - Ref Map

    func testSnapshotPopulatesRefMap() {
        grabTestApp()
        _ = snapshot()
        // After snapshot, lastRefMap should be populated
        XCTAssertFalse(dispatcher.lastRefMap.isEmpty)
    }

    func testSnapshotUpdatesLastSnapshotId() {
        grabTestApp()
        let result = snapshot()
        let snapshotId = result["snapshot_id"] as? String
        XCTAssertEqual(dispatcher.lastSnapshotId, snapshotId)
    }

    func testSnapshotStoresLastSnapshotData() {
        grabTestApp()
        _ = snapshot()
        XCTAssertNotNil(dispatcher.lastSnapshotData)
    }

    // MARK: - Helpers

    private func flattenAll(_ elements: [[String: Any]]) -> [[String: Any]] {
        var flat: [[String: Any]] = []
        for el in elements {
            flat.append(el)
            if let children = el["children"] as? [[String: Any]] {
                flat.append(contentsOf: flattenAll(children))
            }
        }
        return flat
    }
}
