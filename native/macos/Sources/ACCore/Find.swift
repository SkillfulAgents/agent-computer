import Foundation
import ApplicationServices

// MARK: - Element Search

class Find {

    /// Search for elements by label text and/or role
    static func find(
        text: String?,
        role: String?,
        first: Bool,
        windowRef: String?,
        appName: String?,
        windowManager: WindowManager,
        snapshotBuilder: SnapshotBuilder,
        grabbedWindow: String?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // Build a snapshot first to populate the ref map
        let (snapResult, snapError) = snapshotBuilder.build(
            windowRef: grabbedWindow,
            windowManager: windowManager,
            appName: appName
        )

        if let snapError = snapError {
            return (nil, snapError)
        }

        guard let snapResult = snapResult,
              let elements = snapResult["elements"] as? [[String: Any]] else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to build snapshot for search"))
        }

        // Search through elements
        var matches: [[String: Any]] = []
        searchElements(elements, text: text, role: role, matches: &matches)

        if first && !matches.isEmpty {
            return (["ok": true, "elements": [matches[0]], "count": 1], nil)
        }

        return (["ok": true, "elements": matches, "count": matches.count], nil)
    }

    private static func searchElements(_ elements: [[String: Any]], text: String?, role: String?, matches: inout [[String: Any]]) {
        for el in elements {
            let elRole = el["role"] as? String ?? ""
            let elLabel = el["label"] as? String ?? ""
            let elValue = el["value"] as? String ?? ""

            var roleMatch = true
            if let role = role {
                roleMatch = elRole == role
            }

            var textMatch = true
            if let text = text {
                let lowerText = text.lowercased()
                textMatch = elLabel.lowercased().contains(lowerText) ||
                            elValue.lowercased().contains(lowerText)
            }

            if roleMatch && textMatch {
                // Return element without children for search results
                var match = el
                match.removeValue(forKey: "children")
                matches.append(match)
            }

            // Recurse into children
            if let children = el["children"] as? [[String: Any]] {
                searchElements(children, text: text, role: role, matches: &matches)
            }
        }
    }
}
