import XCTest
@testable import ac_core

final class BatchTests: XCTestCase {

    // MARK: - Batch Execution

    func testBatchEmptyCommandsReturnsError() {
        let dispatcher = Dispatcher()
        let (result, error) = Batch.execute(commands: [], stopOnError: true, dispatcher: dispatcher)
        XCTAssertNil(result)
        XCTAssertNotNil(error)
        XCTAssertEqual(error?.error?.code, RPCErrorCode.invalidParams)
    }

    func testBatchSinglePingSucceeds() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"]]
        let (result, error) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertNil(error)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["count"] as? Int, 1)
        XCTAssertEqual(result?["total"] as? Int, 1)
    }

    func testBatchMultiplePingsSucceeds() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"], ["ping"], ["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["count"] as? Int, 3)
        XCTAssertEqual(result?["total"] as? Int, 3)
    }

    func testBatchMixedPingAndVersion() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"], ["version"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertEqual(results?.count, 2)
        XCTAssertEqual(results?[0]["method"] as? String, "ping")
        XCTAssertEqual(results?[1]["method"] as? String, "version")
    }

    func testBatchWithDictParams() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping", ["extra": "ignored"] as [String: Any]]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, true)
    }

    // MARK: - Stop On Error

    func testBatchStopOnErrorTrue() {
        let dispatcher = Dispatcher()
        // nonexistent will fail, ping after it should not run
        let commands: [[Any]] = [["ping"], ["nonexistent_method"], ["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, false)
        XCTAssertEqual(result?["count"] as? Int, 2) // ping succeeded, nonexistent failed, stopped
        XCTAssertEqual(result?["total"] as? Int, 3)
    }

    func testBatchStopOnErrorFalseContinues() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"], ["nonexistent_method"], ["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: false, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, true)
        XCTAssertEqual(result?["count"] as? Int, 3) // All three processed
        XCTAssertEqual(result?["total"] as? Int, 3)
    }

    // MARK: - Invalid Command Format

    func testBatchInvalidCommandFormatNoMethodName() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [[42]] // First element is not a String
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        XCTAssertEqual(result?["ok"] as? Bool, false)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertNotNil(results?[0]["error"])
    }

    func testBatchInvalidFormatContinuesWithStopOnErrorFalse() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [[42], ["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: false, dispatcher: dispatcher)
        XCTAssertEqual(result?["count"] as? Int, 2)
    }

    // MARK: - Positional Arg Mapping

    func testBatchPositionalArgsClick() {
        let dispatcher = Dispatcher()
        // click with positional ref — will fail with elementNotFound but that proves mapping works
        let commands: [[Any]] = [["click", "@b1"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: false, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        // Should have tried to find @b1, meaning ref was mapped
        let errorMsg = results?[0]["error"] as? String ?? ""
        XCTAssertTrue(errorMsg.contains("@b1") || errorMsg.contains("ref") || errorMsg.contains("Element"),
                      "Expected ref-related error, got: \(errorMsg)")
    }

    // NOTE: testBatchPositionalArgsType posts real CGEvents — tested in integration tests only.

    func testBatchPositionalArgsLaunch() {
        let dispatcher = Dispatcher()
        // launch with positional app name — maps to "name"
        let commands: [[Any]] = [["launch", "NonexistentApp12345"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: false, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        let errorMsg = results?[0]["error"] as? String ?? ""
        XCTAssertTrue(errorMsg.contains("NonexistentApp12345") || errorMsg.contains("not found"),
                      "Expected app-related error, got: \(errorMsg)")
    }

    // NOTE: testBatchPositionalArgsKey and testBatchPositionalArgsScroll
    // post real CGEvents — tested in integration tests only.

    // MARK: - Result Structure

    func testBatchResultsHaveIndex() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"], ["version"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertEqual(results?[0]["index"] as? Int, 0)
        XCTAssertEqual(results?[1]["index"] as? Int, 1)
    }

    func testBatchResultsHaveMethod() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertEqual(results?[0]["method"] as? String, "ping")
    }

    func testBatchErrorResultsHaveCode() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["nonexistent_method"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: false, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertNotNil(results?[0]["code"])
        XCTAssertEqual(results?[0]["code"] as? Int, RPCErrorCode.methodNotFound)
    }

    func testBatchSuccessResultsHaveResult() {
        let dispatcher = Dispatcher()
        let commands: [[Any]] = [["ping"]]
        let (result, _) = Batch.execute(commands: commands, stopOnError: true, dispatcher: dispatcher)
        let results = result?["results"] as? [[String: Any]]
        XCTAssertNotNil(results?[0]["result"])
    }
}
