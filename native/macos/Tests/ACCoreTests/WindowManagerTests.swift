import XCTest
@testable import ac_core

final class WindowManagerTests: XCTestCase {

    // MARK: - Window List

    func testListWindowsReturnsArray() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        // May or may not have windows, but should return an array
        XCTAssertTrue(windows is [[String: Any]])
    }

    func testListWindowsHasExpectedFields() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        guard let first = windows.first else {
            // No windows visible — skip
            return
        }
        XCTAssertNotNil(first["ref"])
        XCTAssertNotNil(first["title"])
        XCTAssertNotNil(first["app"])
        XCTAssertNotNil(first["process_id"])
        XCTAssertNotNil(first["bounds"])
        XCTAssertNotNil(first["minimized"])
        XCTAssertNotNil(first["hidden"])
    }

    func testListWindowsRefsAreSequential() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        for (index, win) in windows.enumerated() {
            XCTAssertEqual(win["ref"] as? String, "@w\(index + 1)")
        }
    }

    func testListWindowsResetsOnEachCall() {
        let wm = WindowManager()
        _ = wm.listWindows()
        _ = wm.listWindows()
        // After second call, refs should start from @w1 again
        let windows = wm.listWindows()
        if let first = windows.first {
            XCTAssertEqual(first["ref"] as? String, "@w1")
        }
    }

    func testListWindowsFilterByApp() {
        let wm = WindowManager()
        let allWindows = wm.listWindows()
        guard let firstApp = allWindows.first?["app"] as? String else { return }

        let filtered = wm.listWindows(appName: firstApp)
        for win in filtered {
            XCTAssertEqual((win["app"] as? String)?.lowercased(), firstApp.lowercased())
        }
    }

    // MARK: - Window Info / ID Lookup

    func testGetWindowInfoByRef() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        guard let ref = windows.first?["ref"] as? String else { return }

        let info = wm.getWindowInfo(ref: ref)
        XCTAssertNotNil(info)
        XCTAssertEqual(info?["ref"] as? String, ref)
    }

    func testGetWindowInfoNonexistentRef() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let info = wm.getWindowInfo(ref: "@w9999")
        XCTAssertNil(info)
    }

    func testGetWindowIDForRef() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        guard let ref = windows.first?["ref"] as? String else { return }

        let windowID = wm.getWindowID(ref: ref)
        XCTAssertNotNil(windowID)
    }

    func testGetWindowIDNonexistentRef() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let windowID = wm.getWindowID(ref: "@w9999")
        XCTAssertNil(windowID)
    }

    func testGetPIDForRef() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        guard let ref = windows.first?["ref"] as? String else { return }

        let pid = wm.getPID(ref: ref)
        XCTAssertNotNil(pid)
        XCTAssertGreaterThan(pid!, 0)
    }

    func testGetPIDNonexistentRef() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let pid = wm.getPID(ref: "@w9999")
        XCTAssertNil(pid)
    }

    // MARK: - Window Ref For App

    func testGetWindowRefForApp() {
        let wm = WindowManager()
        let allWindows = wm.listWindows()
        guard let firstApp = allWindows.first?["app"] as? String else { return }

        let ref = wm.getWindowRefForApp(appName: firstApp)
        XCTAssertNotNil(ref)
        XCTAssertTrue(ref?.hasPrefix("@w") ?? false)
    }

    func testGetWindowRefForNonexistentApp() {
        let wm = WindowManager()
        let ref = wm.getWindowRefForApp(appName: "NonExistentApp12345")
        XCTAssertNil(ref)
    }

    // MARK: - Window Actions (require AX — test error paths)

    func testMinimizeNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.minimize(ref: "@w9999")
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.windowNotFound)
    }

    func testMaximizeNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.maximize(ref: "@w9999")
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testCloseNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.close(ref: "@w9999")
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testRaiseNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.raise(ref: "@w9999")
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testMoveNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.move(ref: "@w9999", x: 0, y: 0)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testResizeNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.resize(ref: "@w9999", width: 800, height: 600)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testSetBoundsNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (result, error) = wm.setBounds(ref: "@w9999", x: 0, y: 0, width: 800, height: 600)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
    }

    func testApplyPresetUnknownPresetReturnsError() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        guard let ref = windows.first?["ref"] as? String else { return }

        let (_, error) = wm.applyPreset(ref: ref, preset: "unknown-preset")
        XCTAssertNotNil(error)
        XCTAssertTrue(error?.error?.message.contains("Unknown preset") ?? false)
    }

    func testApplyPresetNonexistentWindowReturnsError() {
        let wm = WindowManager()
        _ = wm.listWindows()
        let (_, error) = wm.applyPreset(ref: "@w9999", preset: "fill")
        XCTAssertNotNil(error)
    }

    // MARK: - Bounds Filter

    func testListWindowsFiltersTinyWindows() {
        let wm = WindowManager()
        let windows = wm.listWindows()
        for win in windows {
            let bounds = win["bounds"] as? [Double] ?? [0, 0, 0, 0]
            XCTAssertGreaterThanOrEqual(bounds[2], 50, "Width should be >= 50")
            XCTAssertGreaterThanOrEqual(bounds[3], 50, "Height should be >= 50")
        }
    }
}
