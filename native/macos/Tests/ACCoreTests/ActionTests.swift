import XCTest
@testable import ac_core

final class ActionTests: XCTestCase {

    // MARK: - Click Validation

    func testClickWithoutRefOrCoordsReturnsError() {
        let (result, error) = Actions.click(
            ref: nil, x: nil, y: nil,
            right: false, double: false, count: 1,
            modifiers: [], refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(error?.error?.message.contains("ref or x,y") ?? false)
    }

    func testClickWithMissingRefReturnsElementNotFound() {
        let (result, error) = Actions.click(
            ref: "@b99", x: nil, y: nil,
            right: false, double: false, count: 1,
            modifiers: [], refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // NOTE: Click-by-coordinates posts real CGEvents — tested in integration tests only.

    // MARK: - Hover Validation

    func testHoverWithoutRefOrCoordsReturnsError() {
        let (result, error) = Actions.hover(
            ref: nil, x: nil, y: nil, refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
    }

    func testHoverWithMissingRefReturnsElementNotFound() {
        let (result, error) = Actions.hover(
            ref: "@b99", x: nil, y: nil, refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // NOTE: MouseButton tests post real CGEvents — tested in integration tests only.

    // MARK: - Drag Validation

    func testDragMissingFromReturnsError() {
        let (result, error) = Drag.drag(
            fromRef: nil, fromX: nil, fromY: nil,
            toRef: nil, toX: 200, toY: 200,
            duration: 0.1, steps: 5,
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(error?.error?.message.contains("from") ?? false)
    }

    func testDragMissingToReturnsError() {
        let (result, error) = Drag.drag(
            fromRef: nil, fromX: 100, fromY: 100,
            toRef: nil, toX: nil, toY: nil,
            duration: 0.1, steps: 5,
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
        XCTAssertTrue(error?.error?.message.contains("to") ?? false)
    }

    func testDragFromRefNotFoundReturnsError() {
        let (result, error) = Drag.drag(
            fromRef: "@b99", fromX: nil, fromY: nil,
            toRef: nil, toX: 200, toY: 200,
            duration: 0.1, steps: 5,
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testDragToRefNotFoundReturnsError() {
        let (result, error) = Drag.drag(
            fromRef: nil, fromX: 100, fromY: 100,
            toRef: "@b99", toX: nil, toY: nil,
            duration: 0.1, steps: 5,
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Scroll

    func testScrollOnRefNotFoundReturnsError() {
        let (result, error) = Scroll.scroll(
            direction: "down", amount: 3,
            onRef: "@sa99", pixels: nil, smooth: false,
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // NOTE: Scroll-without-ref posts real CGEvents — tested in integration tests only.

    // MARK: - Focus / Check / Uncheck / Set (element not found)

    func testFocusElementNotFound() {
        let (result, error) = Focus.focus(ref: "@b99", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testSelectElementNotFound() {
        let (result, error) = Focus.select(ref: "@d99", value: "Red", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testCheckElementNotFound() {
        let (result, error) = Focus.check(ref: "@c99", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testUncheckElementNotFound() {
        let (result, error) = Focus.uncheck(ref: "@c99", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testSetValueElementNotFound() {
        let (result, error) = Focus.setValue(ref: "@s99", value: "50", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Read / Box / Children (element not found)

    func testReadElementNotFound() {
        let (result, error) = Read.read(ref: "@b99", attr: nil, refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testBoxElementNotFound() {
        let (result, error) = Read.box(ref: "@b99", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    func testChildrenElementNotFound() {
        let (result, error) = Read.children(ref: "@b99", refMap: [:])
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.elementNotFound)
    }

    // MARK: - Wait (element)

    func testWaitForElementExistsImmediately() {
        // With an empty refMap but element ref, should timeout quickly
        let (result, error) = Wait.waitForElement(
            ref: "@b99", hidden: false, enabled: false,
            timeout: 100, // 100ms timeout
            refMap: [:]
        )
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.timeout)
    }

    func testWaitForElementHiddenImmediateSuccess() {
        // If element is not in refMap and hidden=true, should succeed (element is "gone")
        let (result, error) = Wait.waitForElement(
            ref: "@b99", hidden: true, enabled: false,
            timeout: 1000,
            refMap: [:]
        )
        XCTAssertNil(error)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["state"] as? String, "hidden")
    }

    func testWaitMsReturnsExpectedDuration() {
        let start = Date()
        let result = Wait.waitMs(ms: 100)
        let elapsed = Date().timeIntervalSince(start) * 1000
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["waited_ms"] as? Int, 100)
        XCTAssertGreaterThanOrEqual(elapsed, 80) // Allow some tolerance
    }
}
