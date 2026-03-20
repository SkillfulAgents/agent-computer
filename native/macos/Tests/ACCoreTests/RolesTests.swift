import XCTest
@testable import ac_core

final class RolesTests: XCTestCase {

    // MARK: - normalizeRole

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
    }

    func testNormalizeRoleUnknownFallsBackToGeneric() {
        XCTAssertEqual(normalizeRole("AXUnknown"), "generic")
        XCTAssertEqual(normalizeRole("AXNonexistent"), "generic")
        XCTAssertEqual(normalizeRole("AXSomethingNew"), "generic")
        XCTAssertEqual(normalizeRole(""), "generic")
    }

    func testNormalizeRoleAlreadyNormalized() {
        // If we pass already-normalized names, they should map through the AX_ROLE_MAP
        // or fall back to generic
        XCTAssertEqual(normalizeRole("button"), "generic") // "button" is not in AX_ROLE_MAP
    }

    // MARK: - prefixForRole

    func testPrefixForRole() {
        XCTAssertEqual(prefixForRole("button"), "b")
        XCTAssertEqual(prefixForRole("textfield"), "t")
        XCTAssertEqual(prefixForRole("textarea"), "t")
        XCTAssertEqual(prefixForRole("link"), "l")
        XCTAssertEqual(prefixForRole("checkbox"), "c")
        XCTAssertEqual(prefixForRole("radio"), "r")
        XCTAssertEqual(prefixForRole("slider"), "s")
        XCTAssertEqual(prefixForRole("dropdown"), "d")
        XCTAssertEqual(prefixForRole("image"), "i")
        XCTAssertEqual(prefixForRole("group"), "g")
        XCTAssertEqual(prefixForRole("tab"), "a")
        XCTAssertEqual(prefixForRole("menuitem"), "m")
        XCTAssertEqual(prefixForRole("table"), "x")
        XCTAssertEqual(prefixForRole("row"), "o")
        XCTAssertEqual(prefixForRole("cell"), "o")
        XCTAssertEqual(prefixForRole("window"), "w")
        XCTAssertEqual(prefixForRole("text"), "e")
        XCTAssertEqual(prefixForRole("tabgroup"), "g")
        XCTAssertEqual(prefixForRole("menubar"), "g")
        XCTAssertEqual(prefixForRole("toolbar"), "g")
        XCTAssertEqual(prefixForRole("splitgroup"), "sp")
        XCTAssertEqual(prefixForRole("timeline"), "tl")
        XCTAssertEqual(prefixForRole("progress"), "pg")
    }

    func testPrefixForRoleTwoLetterPrefixes() {
        XCTAssertEqual(prefixForRole("combobox"), "cb")
        XCTAssertEqual(prefixForRole("scrollarea"), "sa")
        XCTAssertEqual(prefixForRole("stepper"), "st")
        XCTAssertEqual(prefixForRole("treeview"), "tv")
        XCTAssertEqual(prefixForRole("webarea"), "wb")
    }

    func testPrefixForRoleUnknownDefaultsToE() {
        XCTAssertEqual(prefixForRole("generic"), "e")
        XCTAssertEqual(prefixForRole("unknown_role"), "e")
        XCTAssertEqual(prefixForRole(""), "e")
    }

    // MARK: - RefAssigner

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

    func testRefAssignerHighCounts() {
        let assigner = RefAssigner()
        for _ in 1..<100 {
            _ = assigner.assign(role: "button")
        }
        XCTAssertEqual(assigner.assign(role: "button"), "@b100")
    }

    func testRefAssignerGenericRole() {
        let assigner = RefAssigner()
        XCTAssertEqual(assigner.assign(role: "generic"), "@e1")
        XCTAssertEqual(assigner.assign(role: "generic"), "@e2")
    }

    func testRefAssignerAllRolePrefixes() {
        // Verify that assigning multiple roles produces valid, unique refs
        // Some roles share a prefix (e.g. textfield/textarea both use "t",
        // row/cell both use "o"), so shared-prefix roles get incrementing numbers.
        let assigner = RefAssigner()
        let roles = ["button", "textfield", "link", "checkbox", "radio", "slider",
                     "dropdown", "image", "combobox", "scrollarea", "stepper",
                     "treeview", "webarea", "menuitem", "window"]

        var refs: [String] = []
        for role in roles {
            let ref = assigner.assign(role: role)
            refs.append(ref)
            XCTAssertTrue(ref.hasPrefix("@"), "Ref should start with @: \(ref)")
        }

        // All these roles have unique prefixes, so all refs should be unique
        XCTAssertEqual(Set(refs).count, refs.count, "All refs should be unique: \(refs)")
    }
}
