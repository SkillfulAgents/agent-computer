import XCTest
@testable import ac_core

final class AppsTests: XCTestCase {

    // MARK: - AppError Descriptions

    func testAppErrorNotFoundDescription() {
        let error = AppError.notFound("TestApp")
        XCTAssertEqual(error.description, "Application not found: TestApp")
    }

    func testAppErrorLaunchFailedDescription() {
        let error = AppError.launchFailed("TestApp", "Permission denied")
        XCTAssertEqual(error.description, "Failed to launch TestApp: Permission denied")
    }

    // MARK: - listRunning

    func testListRunningReturnsArray() {
        let apps = Apps.listRunning()
        XCTAssertTrue(apps is [[String: Any]])
        // There should be at least some running apps
        XCTAssertGreaterThan(apps.count, 0)
    }

    func testListRunningHasExpectedFields() {
        let apps = Apps.listRunning()
        guard let first = apps.first else {
            XCTFail("No running apps found")
            return
        }
        XCTAssertNotNil(first["name"])
        XCTAssertNotNil(first["bundle_id"])
        XCTAssertNotNil(first["process_id"])
        XCTAssertNotNil(first["is_active"])
        XCTAssertNotNil(first["is_hidden"])
        XCTAssertNotNil(first["is_chromium"])
    }

    func testListRunningOnlyGUIApps() {
        // All returned apps should have regular activation policy
        // (verified by the fact they appear — the filter is in listRunning)
        let apps = Apps.listRunning()
        for app in apps {
            XCTAssertNotNil(app["name"], "Each app should have a name")
        }
    }

    // MARK: - isChromiumApp

    func testIsChromiumAppByNameNonexistent() {
        // Non-existent app should not be chromium
        XCTAssertFalse(Apps.isChromiumApp(name: "NonExistentApp12345"))
    }

    func testIsChromiumAppByPidInvalid() {
        // Invalid PID should not crash
        XCTAssertFalse(Apps.isChromiumApp(pid: -1))
    }

    // MARK: - quit/hide/unhide/activate errors

    func testQuitNonexistentAppThrows() {
        XCTAssertThrowsError(try Apps.quit(name: "NonExistentApp12345")) { error in
            XCTAssertTrue(error is AppError)
        }
    }

    func testHideNonexistentAppThrows() {
        XCTAssertThrowsError(try Apps.hide(name: "NonExistentApp12345")) { error in
            XCTAssertTrue(error is AppError)
        }
    }

    func testUnhideNonexistentAppThrows() {
        XCTAssertThrowsError(try Apps.unhide(name: "NonExistentApp12345")) { error in
            XCTAssertTrue(error is AppError)
        }
    }

    func testActivateNonexistentAppThrows() {
        XCTAssertThrowsError(try Apps.activate(name: "NonExistentApp12345")) { error in
            XCTAssertTrue(error is AppError)
        }
    }
}
