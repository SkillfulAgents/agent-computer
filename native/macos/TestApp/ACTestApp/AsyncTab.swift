import SwiftUI

struct AsyncTab: View {
    @State private var loading = false
    @State private var progress = 0.0
    @State private var resultText = ""
    @State private var timer: Timer? = nil

    var body: some View {
        VStack(spacing: 16) {
            Text("Async Test")
                .font(.title2)
                .accessibilityIdentifier("async-title")

            Button("Start Loading") {
                startLoading()
            }
            .accessibilityIdentifier("btn-start-loading")
            .disabled(loading)

            if loading {
                ProgressView(value: progress)
                    .accessibilityIdentifier("progress-bar")
                    .frame(width: 300)

                Text("Loading... \(Int(progress * 100))%")
                    .accessibilityIdentifier("loading-text")
            }

            if !resultText.isEmpty {
                Text(resultText)
                    .accessibilityIdentifier("result-text")
                    .foregroundColor(.green)
            }

            Divider()

            Button("Show Delayed Element") {
                resultText = ""
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    resultText = "Delayed content appeared!"
                    writeStatus("async:delayed-appeared")
                }
            }
            .accessibilityIdentifier("btn-delayed")

            Button("Reset") {
                loading = false
                progress = 0.0
                resultText = ""
                timer?.invalidate()
                timer = nil
                writeStatus("async:reset")
            }
            .accessibilityIdentifier("btn-async-reset")
        }
        .padding()
    }

    private func startLoading() {
        loading = true
        progress = 0.0
        resultText = ""
        writeStatus("async:loading-started")

        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { t in
            progress += 0.05
            if progress >= 1.0 {
                t.invalidate()
                timer = nil
                loading = false
                resultText = "Loading complete!"
                writeStatus("async:loading-complete")
            }
        }
    }
}
