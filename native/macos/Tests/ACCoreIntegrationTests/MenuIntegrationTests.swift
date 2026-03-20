import XCTest
@testable import ac_core

final class MenuIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
    }

    // MARK: - Menu List

    func testMenuListTopLevel() {
        let result = dispatch("menu_list", params: ["app": "ACTestApp"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        let items = result["items"] as? [[String: Any]]
        XCTAssertNotNil(items)
        XCTAssertGreaterThan(items?.count ?? 0, 0, "Should have at least one menu")
    }

    func testMenuListHasTitles() {
        let result = dispatch("menu_list", params: ["app": "ACTestApp"])
        let items = result["items"] as? [[String: Any]] ?? []
        for item in items {
            XCTAssertNotNil(item["title"])
        }
    }

    // MARK: - Menu List Specific Menu

    func testMenuListFileMenu() {
        // Most apps have an application menu as first item
        let result = dispatch("menu_list", params: ["app": "ACTestApp", "menu": "File"])
        // File menu may not exist in TestApp, which is OK
        if result["ok"] as? Bool == true {
            XCTAssertNotNil(result["items"])
        }
    }

    // MARK: - Menubar Extras

    func testMenubarExtras() {
        let result = dispatch("menubar")
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertNotNil(result["extras"])
    }
}
