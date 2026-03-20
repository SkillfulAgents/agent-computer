import XCTest
@testable import ac_core

final class ScrollIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
        snapshot()
    }

    // MARK: - Basic Scroll

    func testScrollDown() {
        let result = dispatch("scroll", params: ["direction": "down"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["direction"] as? String, "down")
    }

    func testScrollUp() {
        let result = dispatch("scroll", params: ["direction": "up"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["direction"] as? String, "up")
    }

    func testScrollLeft() {
        let result = dispatch("scroll", params: ["direction": "left"])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    func testScrollRight() {
        let result = dispatch("scroll", params: ["direction": "right"])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    // MARK: - Scroll with Amount

    func testScrollWithCustomAmount() {
        let result = dispatch("scroll", params: ["direction": "down", "amount": 5])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["amount"] as? Int, 5)
    }

    // MARK: - Smooth Scroll

    func testSmoothScroll() {
        let result = dispatch("scroll", params: ["direction": "down", "smooth": true])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }

    // MARK: - Scroll on Element

    func testScrollOnNonexistentRefReturnsError() {
        let error = dispatchExpectingError("scroll", params: ["direction": "down", "on": "@sa9999"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Scroll with Pixels

    func testScrollWithPixels() {
        let result = dispatch("scroll", params: ["direction": "down", "pixels": 100])
        XCTAssertEqual(result["ok"] as? Bool, true)
    }
}
