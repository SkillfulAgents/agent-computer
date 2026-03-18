import Foundation

// AXRole → normalized role mapping
let AX_ROLE_MAP: [String: String] = [
    "AXButton": "button",
    "AXTextField": "textfield",
    "AXTextArea": "textarea",
    "AXLink": "link",
    "AXCheckBox": "checkbox",
    "AXRadioButton": "radio",
    "AXSlider": "slider",
    "AXPopUpButton": "dropdown",
    "AXImage": "image",
    "AXGroup": "group",
    "AXWindow": "window",
    "AXTable": "table",
    "AXRow": "row",
    "AXCell": "cell",
    "AXTabGroup": "tabgroup",
    "AXTab": "tab",
    "AXMenuBar": "menubar",
    "AXMenuItem": "menuitem",
    "AXScrollArea": "scrollarea",
    "AXStaticText": "text",
    "AXToolbar": "toolbar",
    "AXComboBox": "combobox",
    "AXStepper": "stepper",
    "AXSplitGroup": "splitgroup",
    "AXTimeline": "timeline",
    "AXProgressIndicator": "progress",
    "AXOutline": "treeview",
    "AXWebArea": "webarea",
    "AXSheet": "generic",
    "AXDrawer": "generic",
    "AXValueIndicator": "generic",
    "AXBrowser": "generic",
    "AXBusyIndicator": "progress",
    "AXDisclosureTriangle": "button",
    "AXIncrementor": "stepper",
    "AXColorWell": "generic",
    "AXList": "table",
    "AXMenu": "menubar",
    "AXMenuButton": "button",
    "AXRadioGroup": "group",
    "AXRuler": "generic",
    "AXSplitter": "generic",
    "AXSystemWide": "generic",
    "AXUnknown": "generic",
]

// Normalized role → ref prefix
let ROLE_PREFIX_MAP: [String: String] = [
    "button": "b",
    "textfield": "t",
    "textarea": "t",
    "link": "l",
    "menuitem": "m",
    "checkbox": "c",
    "radio": "r",
    "slider": "s",
    "dropdown": "d",
    "image": "i",
    "group": "g",
    "window": "w",
    "table": "x",
    "row": "o",
    "cell": "o",
    "tabgroup": "g",
    "tab": "a",
    "menubar": "g",
    "scrollarea": "sa",
    "text": "e",
    "toolbar": "g",
    "combobox": "cb",
    "stepper": "st",
    "splitgroup": "sp",
    "timeline": "tl",
    "progress": "pg",
    "treeview": "tv",
    "webarea": "wb",
    "generic": "e",
]

func normalizeRole(_ axRole: String) -> String {
    return AX_ROLE_MAP[axRole] ?? "generic"
}

func prefixForRole(_ normalizedRole: String) -> String {
    return ROLE_PREFIX_MAP[normalizedRole] ?? "e"
}

// Ref assignment counter
class RefAssigner {
    private var counters: [String: Int] = [:]

    func assign(role: String) -> String {
        let normalizedRole = role.hasPrefix("AX") ? normalizeRole(role) : role
        let prefix = prefixForRole(normalizedRole)
        let count = (counters[prefix] ?? 0) + 1
        counters[prefix] = count
        return "@\(prefix)\(count)"
    }

    func reset() {
        counters = [:]
    }
}
