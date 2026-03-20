import Foundation

/// Side-channel communication: writes status to a file that tests can read
/// This avoids needing to parse the UI to verify actions took effect

private let statusFilePath = "/tmp/ac-test-status.txt"

func writeStatus(_ status: String) {
    let entry = "\(ISO8601DateFormatter().string(from: Date())) \(status)\n"

    if FileManager.default.fileExists(atPath: statusFilePath) {
        if let handle = FileHandle(forWritingAtPath: statusFilePath) {
            handle.seekToEndOfFile()
            handle.write(entry.data(using: .utf8)!)
            handle.closeFile()
        }
    } else {
        try? entry.write(toFile: statusFilePath, atomically: true, encoding: .utf8)
    }
}

func readStatus() -> String {
    return (try? String(contentsOfFile: statusFilePath, encoding: .utf8)) ?? ""
}

func clearStatus() {
    try? "".write(toFile: statusFilePath, atomically: true, encoding: .utf8)
}
