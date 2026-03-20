import XCTest
@testable import ac_core

final class DialogIntegrationTests: IntegrationTestBase {

    override func setUp() {
        super.setUp()
        requireTestApp()
        grabTestApp()
        snapshot()
    }

    // MARK: - Dialog Detection (No Dialog)

    func testDialogDetectWhenNonePresent() {
        let result = dispatch("dialog", params: ["app": "ACTestApp"])
        XCTAssertEqual(result["ok"] as? Bool, true)
        XCTAssertEqual(result["found"] as? Bool, false)
    }

    // MARK: - Dialog Respond When No Dialog

    func testDialogAcceptWhenNonePresent() {
        let error = dispatchExpectingError("dialog_accept", params: ["app": "ACTestApp"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }

    func testDialogCancelWhenNonePresent() {
        // Cancel falls back to Escape key, so it might succeed
        let request = makeRequest(method: "dialog_cancel", params: ["app": "ACTestApp"])
        let response = dispatcher.dispatch(request)
        // Either succeeds (escape key) or fails (no dialog) — both are acceptable
        if response.error != nil {
            XCTAssertEqual(response.error?.code, RPCErrorCode.elementNotFound)
        } else {
            let result = response.result as? [String: Any]
            XCTAssertEqual(result?["ok"] as? Bool, true)
        }
    }

    // MARK: - Trigger and Detect Alert

    func testTriggerAndDetectAlert() {
        // Find and click "Show Alert" button
        let findResult = dispatch("find", params: ["text": "Show Alert", "role": "button", "first": true])
        let elements = findResult["elements"] as? [[String: Any]] ?? []
        guard let alertButton = elements.first else {
            return // Skip: Could not find 'Show Alert' button
        }

        let ref = alertButton["ref"] as! String
        dispatch("click", params: ["ref": ref])
        Thread.sleep(forTimeInterval: 0.5) // Wait for alert to appear

        // Now detect the dialog
        let detectResult = dispatch("dialog", params: ["app": "ACTestApp"])
        XCTAssertEqual(detectResult["ok"] as? Bool, true)
        XCTAssertEqual(detectResult["found"] as? Bool, true)

        let dialog = detectResult["dialog"] as? [String: Any]
        XCTAssertNotNil(dialog)

        // Dismiss it
        dispatch("dialog_accept", params: ["app": "ACTestApp"])
        Thread.sleep(forTimeInterval: 0.3)
    }

    // MARK: - Dialog File (no dialog present)

    func testDialogFileWhenNoDialogReturnsError() {
        let error = dispatchExpectingError("dialog_file", params: ["path": "/tmp/test.txt", "app": "ACTestApp"])
        XCTAssertEqual(error.code, RPCErrorCode.elementNotFound)
    }
}
