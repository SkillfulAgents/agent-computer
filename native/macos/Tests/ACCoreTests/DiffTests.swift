import XCTest
@testable import ac_core

final class DiffTests: XCTestCase {

    // MARK: - changed() without previous snapshot

    func testChangedWithoutPreviousSnapshotReturnsError() {
        let wm = WindowManager()
        let sb = SnapshotBuilder()
        let (result, error) = Diff.changed(
            windowRef: nil, appName: nil,
            windowManager: wm, snapshotBuilder: sb,
            grabbedWindow: nil, lastSnapshotData: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertTrue(error?.error?.message.contains("No previous snapshot") ?? false)
    }

    // MARK: - diff() without previous snapshot

    func testDiffWithoutPreviousSnapshotReturnsError() {
        let wm = WindowManager()
        let sb = SnapshotBuilder()
        let (result, error) = Diff.diff(
            windowRef: nil, appName: nil,
            windowManager: wm, snapshotBuilder: sb,
            grabbedWindow: nil, lastSnapshotData: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertTrue(error?.error?.message.contains("No previous snapshot") ?? false)
    }
}
