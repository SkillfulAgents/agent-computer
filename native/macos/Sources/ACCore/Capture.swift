import Foundation
import AppKit
import ImageIO

// MARK: - Screenshot Capture

class Capture {

    /// Take a screenshot of a window or the full screen
    static func screenshot(
        windowRef: String?,
        windowManager: WindowManager,
        fullScreen: Bool,
        retina: Bool,
        format: String,
        quality: Int,
        outputPath: String?
    ) -> (result: [String: Any]?, error: RPCResponse?) {

        // Determine output path
        let dir: String
        if let outputPath = outputPath {
            dir = URL(fileURLWithPath: outputPath).deletingLastPathComponent().path
        } else {
            dir = "/tmp/ac"
        }
        let filename = outputPath ?? generateFilename(dir: dir, format: format)

        // Ensure output directory exists
        try? FileManager.default.createDirectory(
            atPath: URL(fileURLWithPath: filename).deletingLastPathComponent().path,
            withIntermediateDirectories: true)

        var args = ["-x"] // No sound
        args.append(contentsOf: ["-t", format == "jpeg" ? "jpg" : "png"])

        if fullScreen {
            // Full screen capture — no extra flags needed
        } else if let ref = windowRef {
            // Window capture by CGWindowID
            guard let windowID = resolveWindowID(ref: ref, windowManager: windowManager) else {
                return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.windowNotFound,
                    message: "Window not found: \(ref)"))
            }
            args.append(contentsOf: ["-l", String(windowID)])
        } else {
            // No ref and not fullScreen — fall back to full screen capture
            // (-w triggers interactive mode with camera cursor, which doesn't
            // work from a background daemon)
        }

        args.append(filename)

        return runScreenCapture(args: args, path: filename)
    }

    /// List connected displays
    static func listDisplays() -> [[String: Any]] {
        var displays: [[String: Any]] = []

        for (index, screen) in NSScreen.screens.enumerated() {
            let frame = screen.frame
            let isMain = screen == NSScreen.main
            let scaleFactor = screen.backingScaleFactor

            displays.append([
                "id": index,
                "width": Int(frame.width),
                "height": Int(frame.height),
                "x": Int(frame.origin.x),
                "y": Int(frame.origin.y),
                "is_main": isMain,
                "scale_factor": Double(scaleFactor),
            ])
        }

        return displays
    }

    // MARK: - Helpers

    private static func resolveWindowID(ref: String, windowManager: WindowManager) -> CGWindowID? {
        if let id = windowManager.getWindowID(ref: ref) {
            return id
        }
        // Refresh and retry
        _ = windowManager.listWindows()
        return windowManager.getWindowID(ref: ref)
    }

    private static func runScreenCapture(args: [String], path: String) -> (result: [String: Any]?, error: RPCResponse?) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = args

        let pipe = Pipe()
        process.standardError = pipe

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Failed to run screencapture: \(error.localizedDescription)"))
        }

        guard process.terminationStatus == 0 else {
            let stderr = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.permissionDenied,
                message: "screencapture failed (exit \(process.terminationStatus)): \(stderr)"))
        }

        // Verify file was created
        guard FileManager.default.fileExists(atPath: path) else {
            return (nil, RPCResponse.error(id: 0, code: RPCErrorCode.invalidRequest,
                message: "Screenshot file was not created at \(path)"))
        }

        // Read image dimensions
        let url = URL(fileURLWithPath: path)
        if let imageSource = CGImageSourceCreateWithURL(url as CFURL, nil),
           let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [String: Any],
           let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
           let height = properties[kCGImagePropertyPixelHeight as String] as? Int {
            return (["ok": true, "path": path, "width": width, "height": height], nil)
        }

        return (["ok": true, "path": path, "width": 0, "height": 0], nil)
    }

    private static func generateFilename(dir: String, format: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd-HHmmss"
        let timestamp = formatter.string(from: Date())
        let ext = format == "jpeg" ? "jpg" : "png"
        return "\(dir)/ac-\(timestamp).\(ext)"
    }
}
