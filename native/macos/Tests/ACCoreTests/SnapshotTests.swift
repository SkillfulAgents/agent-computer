import XCTest
@testable import ac_core

final class SnapshotTests: XCTestCase {

    // MARK: - Snapshot without target

    func testSnapshotWithNoTargetReturnsError() {
        let sb = SnapshotBuilder()
        let wm = WindowManager()
        let (result, error) = sb.build(
            windowRef: nil,
            windowManager: wm,
            interactive: false,
            compact: false,
            depth: nil,
            subtreeRef: nil,
            appName: nil,
            pid: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertTrue(error?.error?.message.contains("No window grabbed") ?? false)
    }

    func testSnapshotWithNonexistentWindowRefReturnsError() {
        let sb = SnapshotBuilder()
        let wm = WindowManager()
        let (result, error) = sb.build(
            windowRef: "@w9999",
            windowManager: wm,
            interactive: false,
            compact: false,
            depth: nil,
            subtreeRef: nil,
            appName: nil,
            pid: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.windowNotFound)
    }

    func testSnapshotWithNonexistentAppReturnsError() {
        let sb = SnapshotBuilder()
        let wm = WindowManager()
        let (result, error) = sb.build(
            windowRef: nil,
            windowManager: wm,
            interactive: false,
            compact: false,
            depth: nil,
            subtreeRef: nil,
            appName: "NonExistentApp12345",
            pid: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.appNotFound)
    }

    func testSnapshotWithInvalidPIDReturnsError() {
        let sb = SnapshotBuilder()
        let wm = WindowManager()
        let (result, error) = sb.build(
            windowRef: nil,
            windowManager: wm,
            interactive: false,
            compact: false,
            depth: nil,
            subtreeRef: nil,
            appName: nil,
            pid: 99999
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.windowNotFound)
    }

    // MARK: - getRefMap

    func testGetRefMapInitiallyEmpty() {
        let sb = SnapshotBuilder()
        XCTAssertTrue(sb.getRefMap().isEmpty)
    }
}
