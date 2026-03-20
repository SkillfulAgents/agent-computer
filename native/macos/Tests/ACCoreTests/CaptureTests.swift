import XCTest
@testable import ac_core

final class CaptureTests: XCTestCase {

    // MARK: - listDisplays

    func testListDisplaysReturnsAtLeastOne() {
        let displays = Capture.listDisplays()
        XCTAssertGreaterThanOrEqual(displays.count, 1)
    }

    func testListDisplaysHasExpectedFields() {
        let displays = Capture.listDisplays()
        guard let first = displays.first else {
            XCTFail("No displays found")
            return
        }
        XCTAssertNotNil(first["id"])
        XCTAssertNotNil(first["width"])
        XCTAssertNotNil(first["height"])
        XCTAssertNotNil(first["x"])
        XCTAssertNotNil(first["y"])
        XCTAssertNotNil(first["is_main"])
        XCTAssertNotNil(first["scale_factor"])
    }

    func testListDisplaysMainDisplayExists() {
        let displays = Capture.listDisplays()
        let hasMain = displays.contains { ($0["is_main"] as? Bool) == true }
        XCTAssertTrue(hasMain, "At least one display should be the main display")
    }

    func testListDisplaysReasonableDimensions() {
        let displays = Capture.listDisplays()
        for display in displays {
            let width = display["width"] as? Int ?? 0
            let height = display["height"] as? Int ?? 0
            XCTAssertGreaterThan(width, 0)
            XCTAssertGreaterThan(height, 0)
        }
    }

    func testListDisplaysScaleFactor() {
        let displays = Capture.listDisplays()
        for display in displays {
            let scale = display["scale_factor"] as? Double ?? 0
            XCTAssertGreaterThanOrEqual(scale, 1.0)
            XCTAssertLessThanOrEqual(scale, 3.0)
        }
    }

    // MARK: - Screenshot with nonexistent window

    func testScreenshotNonexistentWindowReturnsError() {
        let wm = WindowManager()
        let (result, error) = Capture.screenshot(
            windowRef: "@w9999",
            windowManager: wm,
            fullScreen: false,
            retina: false,
            format: "png",
            quality: 85,
            outputPath: nil
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.windowNotFound)
    }
}
