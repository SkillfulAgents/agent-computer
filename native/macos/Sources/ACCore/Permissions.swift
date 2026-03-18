import Foundation
import ApplicationServices
import AppKit

enum Permissions {

    /// Check if Accessibility permission is granted
    static func isAccessibilityTrusted() -> Bool {
        return AXIsProcessTrusted()
    }

    /// Check if Screen Recording permission is granted
    static func isScreenRecordingGranted() -> Bool {
        return CGPreflightScreenCaptureAccess()
    }

    /// Open System Settings > Privacy > Accessibility
    static func openAccessibilitySettings() {
        let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
        NSWorkspace.shared.open(url)
    }

    /// Open System Settings > Privacy > Screen Recording
    static func openScreenRecordingSettings() {
        let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")!
        NSWorkspace.shared.open(url)
    }
}
