import XCTest
@testable import ac_core

final class BatchIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
    }

    // MARK: - Batch Through Dispatcher

    func testBatchPingAndVersion() {
        let commands: [Any] = [["ping"], ["version"]]
        let result = dispatch("batch", params: ["commands": commands])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 2)
        XCTAssertEqual(result["total"] as? Int, 2)
    }

    func testBatchWithErrorStops() {
        let commands: [Any] = [["ping"], ["nonexistent_xyz"], ["version"]]
        let result = dispatch("batch", params: ["commands": commands, "stop_on_error": true])
        XCTAssertEqual(result["ok"] as? Bool, false)
        XCTAssertEqual(result["count"] as? Int, 2) // stopped after error
    }

    func testBatchWithErrorContinues() {
        let commands: [Any] = [["ping"], ["nonexistent_xyz"], ["version"]]
        let result = dispatch("batch", params: ["commands": commands, "stop_on_error": false])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 3)
    }

    func testBatchSnapshotThenFind() {
        let commands: [Any] = [
            ["snapshot"],
            ["find", ["text": "Buttons"] as [String: Any]]
        ]
        let result = dispatch("batch", params: ["commands": commands])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["count"] as? Int, 2)
    }
}
