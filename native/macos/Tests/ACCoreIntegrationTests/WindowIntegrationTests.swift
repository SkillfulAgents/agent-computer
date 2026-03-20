import XCTest
@testable import ac_core

final class WindowIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
    }

    // MARK: - Windows List

    func testWindowsListReturnsResults() {
        let result = dispatch("windows")
        XCTAssertNotNil(result["windows"])
        let windows = result["windows"] as? [[String: Any]] ?? []
        XCTAssertGreaterThan(windows.count, 0)
    }

    func testWindowsListFilterByApp() {
        let result = dispatch("windows", params: ["app": "ACTestApp"])
        let windows = result["windows"] as? [[String: Any]] ?? []
        for win in windows {
            XCTAssertEqual((win["app"] as? String)?.lowercased(), "actestapp")
        }
    }

    // MARK: - Grab / Ungrab

    func testGrabByApp() {
        let result = dispatch("grab", params: ["app": "ACTestApp"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertNotNil(result["window"])
        XCTAssertNotNil(dispatcher.grabbedWindow)
    }

    func testGrabSetsGrabbedWindow() {
        dispatch("grab", params: ["app": "ACTestApp"])
        XCTAssertNotNil(dispatcher.grabbedWindow)
        XCTAssertTrue(dispatcher.grabbedWindow?.hasPrefix("@w") ?? false)
    }

    func testUngrabClearsGrabbedWindow() {
        dispatch("grab", params: ["app": "ACTestApp"])
        XCTAssertNotNil(dispatcher.grabbedWindow)

        dispatch("ungrab")
        XCTAssertNil(dispatcher.grabbedWindow)
    }

    func testGrabNonexistentAppReturnsError() {
        let error = dispatchExpectingError("grab", params: ["app": "NonExistentApp12345"])
        XCTAssertEqual(error.code, RPCErrorCode.windowNotFound)
    }

    func testGrabNonexistentRefReturnsError() {
        let error = dispatchExpectingError("grab", params: ["ref": "@w9999"])
        XCTAssertEqual(error.code, RPCErrorCode.windowNotFound)
    }

    // MARK: - Window Info in Grab Response

    func testGrabResponseHasWindowInfo() {
        let result = dispatch("grab", params: ["app": "ACTestApp"])
        let window = result["window"] as? [String: Any]
        XCTAssertNotNil(window)
        XCTAssertNotNil(window?["ref"])
        XCTAssertNotNil(window?["title"])
        XCTAssertNotNil(window?["app"])
    }

    // MARK: - Apps List

    func testAppsListIncludesTestApp() {
        let result = dispatch("apps")
        let apps = result["apps"] as? [[String: Any]] ?? []
        let hasTestApp = apps.contains { ($0["name"] as? String) == "ACTestApp" }
        XCTAssertTrue(hasTestApp, "TestApp should be in running apps list")
    }

    // MARK: - Displays

    func testDisplaysReturnsAtLeastOne() {
        let result = dispatch("displays")
        let displays = result["displays"] as? [[String: Any]] ?? []
        XCTAssertGreaterThan(displays.count, 0)
    }

    // MARK: - Clipboard (through dispatcher)

    func testClipboardSetAndRead() {
        let testText = "integration-test-\(UUID().uuidString)"
        dispatch("clipboard_set", params: ["text": testText])
        let readResult = dispatch("clipboard_read")
        XCTAssertEqual(readResult["text"] as? String, testText)
    }
}
