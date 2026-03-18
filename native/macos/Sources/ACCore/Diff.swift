import Foundation
import ApplicationServices

// MARK: - Snapshot Diff / Changed Detection

class Diff {

    /// Check if the current snapshot differs from the last stored snapshot
    static func changed(
        windowRef: String?,
        appName: String?,
        windowManager: WindowManager,
        snapshotBuilder: SnapshotBuilder,
        grabbedWindow: String?,
        lastSnapshotData: [String: Any]?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard let previousData = lastSnapshotData else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "No previous snapshot to compare. Take a snapshot first."))
        }

        // Take a new snapshot
        let (newResult, error) = snapshotBuilder.build(
            windowRef: windowRef ?? grabbedWindow,
            windowManager: windowManager,
            interactive: false,
            compact: true,
            depth: nil,
            subtreeRef: nil,
            appName: appName,
            pid: nil
        )

        if let error = error {
            return (nil, RPCResponse.error(id: 0, code: error.error?.code ?? -32600,
                message: error.error?.message ?? "Snapshot failed"))
        }

        guard let newData = newResult else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to take new snapshot"))
        }

        // Compare the element trees
        let previousElements = extractElementSignatures(previousData)
        let newElements = extractElementSignatures(newData)

        let changed = previousElements != newElements
        let added = newElements.subtracting(previousElements)
        let removed = previousElements.subtracting(newElements)

        var result: [String: Any] = [
            "ok": true,
            "changed": changed,
        ]

        if changed {
            result["added_count"] = added.count
            result["removed_count"] = removed.count
        }

        return (result, nil)
    }

    /// Diff two snapshots and return the differences
    static func diff(
        windowRef: String?,
        appName: String?,
        windowManager: WindowManager,
        snapshotBuilder: SnapshotBuilder,
        grabbedWindow: String?,
        lastSnapshotData: [String: Any]?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        guard let previousData = lastSnapshotData else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "No previous snapshot to compare. Take a snapshot first."))
        }

        // Take a new snapshot
        let (newResult, error) = snapshotBuilder.build(
            windowRef: windowRef ?? grabbedWindow,
            windowManager: windowManager,
            interactive: false,
            compact: true,
            depth: nil,
            subtreeRef: nil,
            appName: appName,
            pid: nil
        )

        if let error = error {
            return (nil, RPCResponse.error(id: 0, code: error.error?.code ?? -32600,
                message: error.error?.message ?? "Snapshot failed"))
        }

        guard let newData = newResult else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to take new snapshot"))
        }

        let previousElements = extractElementList(previousData)
        let newElements = extractElementList(newData)

        // Build sets for comparison
        let prevSigs = Set(previousElements.map { elementSignature($0) })
        let newSigs = Set(newElements.map { elementSignature($0) })

        let added = newElements.filter { !prevSigs.contains(elementSignature($0)) }
        let removed = previousElements.filter { !newSigs.contains(elementSignature($0)) }

        return ([
            "ok": true,
            "changed": !added.isEmpty || !removed.isEmpty,
            "added": added.map { simplifyElement($0) },
            "removed": removed.map { simplifyElement($0) },
        ] as [String: Any], nil)
    }

    // MARK: - Helpers

    private static func extractElementSignatures(_ snapshotData: [String: Any]) -> Set<String> {
        let elements = extractElementList(snapshotData)
        return Set(elements.map { elementSignature($0) })
    }

    private static func extractElementList(_ snapshotData: [String: Any]) -> [[String: Any]] {
        var elements: [[String: Any]] = []

        if let topElements = snapshotData["elements"] as? [[String: Any]] {
            for el in topElements {
                flattenElements(el, into: &elements)
            }
        }

        return elements
    }

    private static func flattenElements(_ element: [String: Any], into list: inout [[String: Any]]) {
        list.append(element)
        if let children = element["children"] as? [[String: Any]] {
            for child in children {
                flattenElements(child, into: &list)
            }
        }
    }

    private static func elementSignature(_ element: [String: Any]) -> String {
        let role = element["role"] as? String ?? ""
        let label = element["label"] as? String ?? ""
        let value = "\(element["value"] ?? "")"
        let ref = element["ref"] as? String ?? ""
        return "\(role)|\(label)|\(value)|\(ref)"
    }

    private static func simplifyElement(_ element: [String: Any]) -> [String: Any] {
        var simple: [String: Any] = [:]
        if let role = element["role"] as? String { simple["role"] = role }
        if let label = element["label"] as? String { simple["label"] = label }
        if let ref = element["ref"] as? String { simple["ref"] = ref }
        if let value = element["value"] { simple["value"] = value }
        return simple
    }
}
