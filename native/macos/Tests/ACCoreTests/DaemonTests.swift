import XCTest
@testable import ac_core

final class DaemonTests: XCTestCase {

    // MARK: - DaemonError Descriptions

    func testDaemonErrorSocketCreationFailed() {
        let error = DaemonError.socketCreationFailed(13)
        XCTAssertEqual(error.description, "Failed to create socket (errno 13)")
    }

    func testDaemonErrorSocketPathTooLong() {
        let longPath = String(repeating: "a", count: 200)
        let error = DaemonError.socketPathTooLong(longPath)
        XCTAssertTrue(error.description.contains("Socket path too long"))
        XCTAssertTrue(error.description.contains(longPath))
    }

    func testDaemonErrorBindFailed() {
        let error = DaemonError.bindFailed(48) // EADDRINUSE
        XCTAssertEqual(error.description, "Failed to bind socket (errno 48)")
    }

    func testDaemonErrorListenFailed() {
        let error = DaemonError.listenFailed(22) // EINVAL
        XCTAssertEqual(error.description, "Failed to listen on socket (errno 22)")
    }

    // MARK: - DaemonServer Init

    func testDaemonServerInitSetsSocketPath() {
        let dispatcher = Dispatcher()
        let server = DaemonServer(dispatcher: dispatcher)
        XCTAssertTrue(server.socketPath.hasSuffix("daemon.sock"))
        XCTAssertTrue(server.socketPath.contains(".ac"))
    }

    // MARK: - Shutdown Request

    func testDaemonServerRequestShutdown() {
        let dispatcher = Dispatcher()
        let server = DaemonServer(dispatcher: dispatcher)
        // Should not crash
        server.requestShutdown()
    }
}
