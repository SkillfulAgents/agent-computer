import SwiftUI

struct ButtonsTab: View {
    @State private var clickCount = 0
    @State private var lastClicked = ""
    @State private var doubleClicked = false

    var body: some View {
        VStack(spacing: 16) {
            Text("Buttons Test")
                .font(.title2)
                .accessibilityIdentifier("buttons-title")

            HStack(spacing: 12) {
                Button("Primary") {
                    clickCount += 1
                    lastClicked = "Primary"
                    writeStatus("clicked:Primary:\(clickCount)")
                }
                .accessibilityIdentifier("btn-primary")

                Button("Secondary") {
                    clickCount += 1
                    lastClicked = "Secondary"
                    writeStatus("clicked:Secondary:\(clickCount)")
                }
                .accessibilityIdentifier("btn-secondary")

                Button("Danger") {
                    clickCount += 1
                    lastClicked = "Danger"
                    writeStatus("clicked:Danger:\(clickCount)")
                }
                .accessibilityIdentifier("btn-danger")
                .foregroundColor(.red)
            }

            HStack(spacing: 12) {
                Button("Disabled") { }
                    .disabled(true)
                    .accessibilityIdentifier("btn-disabled")

                Button("Hidden") { }
                    .accessibilityIdentifier("btn-hidden")
                    .opacity(clickCount > 5 ? 1 : 0)
            }

            Divider()

            Text("Click count: \(clickCount)")
                .accessibilityIdentifier("click-count")
            Text("Last clicked: \(lastClicked)")
                .accessibilityIdentifier("last-clicked")

            Button("Reset") {
                clickCount = 0
                lastClicked = ""
                doubleClicked = false
                writeStatus("reset")
            }
            .accessibilityIdentifier("btn-reset")
        }
        .padding()
    }
}
