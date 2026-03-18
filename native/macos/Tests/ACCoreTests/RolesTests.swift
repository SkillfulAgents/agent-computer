import XCTest
@testable import ac_core

final class RolesTests: XCTestCase {

    func testNormalizeRole() {
        XCTAssertEqual(normalizeRole("AXButton"), "button")
        XCTAssertEqual(normalizeRole("AXTextField"), "textfield")
        XCTAssertEqual(normalizeRole("AXTextArea"), "textarea")
        XCTAssertEqual(normalizeRole("AXLink"), "link")
        XCTAssertEqual(normalizeRole("AXCheckBox"), "checkbox")
        XCTAssertEqual(normalizeRole("AXRadioButton"), "radio")
        XCTAssertEqual(normalizeRole("AXSlider"), "slider")
        XCTAssertEqual(normalizeRole("AXPopUpButton"), "dropdown")
        XCTAssertEqual(normalizeRole("AXImage"), "image")
        XCTAssertEqual(normalizeRole("AXGroup"), "group")
        XCTAssertEqual(normalizeRole("AXWindow"), "window")
        XCTAssertEqual(normalizeRole("AXTable"), "table")
        XCTAssertEqual(normalizeRole("AXRow"), "row")
        XCTAssertEqual(normalizeRole("AXCell"), "cell")
        XCTAssertEqual(normalizeRole("AXTabGroup"), "tabgroup")
        XCTAssertEqual(normalizeRole("AXTab"), "tab")
        XCTAssertEqual(normalizeRole("AXMenuBar"), "menubar")
        XCTAssertEqual(normalizeRole("AXMenuItem"), "menuitem")
        XCTAssertEqual(normalizeRole("AXScrollArea"), "scrollarea")
        XCTAssertEqual(normalizeRole("AXStaticText"), "text")
        XCTAssertEqual(normalizeRole("AXComboBox"), "combobox")
        XCTAssertEqual(normalizeRole("AXStepper"), "stepper")
        XCTAssertEqual(normalizeRole("AXSplitGroup"), "splitgroup")
        XCTAssertEqual(normalizeRole("AXProgressIndicator"), "progress")
        XCTAssertEqual(normalizeRole("AXOutline"), "treeview")
        XCTAssertEqual(normalizeRole("AXWebArea"), "webarea")
        XCTAssertEqual(normalizeRole("AXUnknown"), "generic")
        XCTAssertEqual(normalizeRole("AXNonexistent"), "generic")
    }

    func testPrefixForRole() {
        XCTAssertEqual(prefixForRole("button"), "b")
        XCTAssertEqual(prefixForRole("textfield"), "t")
        XCTAssertEqual(prefixForRole("combobox"), "cb")
        XCTAssertEqual(prefixForRole("scrollarea"), "sa")
        XCTAssertEqual(prefixForRole("stepper"), "st")
        XCTAssertEqual(prefixForRole("treeview"), "tv")
        XCTAssertEqual(prefixForRole("webarea"), "wb")
        XCTAssertEqual(prefixForRole("generic"), "e")
        XCTAssertEqual(prefixForRole("unknown_role"), "e")
    }

    func testRefAssignerSequential() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "button"), "@b1")
        XCTAssertEqual(assigner.assign(role: "button"), "@b2")
        XCTAssertEqual(assigner.assign(role: "button"), "@b3")
    }

    func testRefAssignerCrossType() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "button"), "@b1")
        XCTAssertEqual(assigner.assign(role: "textfield"), "@t1")
        XCTAssertEqual(assigner.assign(role: "button"), "@b2")
        XCTAssertEqual(assigner.assign(role: "link"), "@l1")
    }

    func testRefAssignerWithAXRoles() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "AXButton"), "@b1")
        XCTAssertEqual(assigner.assign(role: "AXTextField"), "@t1")
        XCTAssertEqual(assigner.assign(role: "AXComboBox"), "@cb1")
    }

    func testRefAssignerReset() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "button"), "@b1")
        XCTAssertEqual(assigner.assign(role: "button"), "@b2")
        assigner.reset()
        XCTAssertEqual(assigner.assign(role: "button"), "@b1")
    }

    func testRefAssignerTwoLetterPrefixes() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "combobox"), "@cb1")
        XCTAssertEqual(assigner.assign(role: "scrollarea"), "@sa1")
        XCTAssertEqual(assigner.assign(role: "combobox"), "@cb2")
    }
}
