import SwiftUI

struct DialogsTab: View {
    @State private var showAlert = false
    @State private var showConfirm = false
    @State private var showSheet = false
    @State private var alertResult = ""
    @State private var sheetText = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("Dialogs Test")
                .font(.title2)
                .accessibilityIdentifier("dialogs-title")

            Button("Show Alert") {
                showAlert = true
            }
            .accessibilityIdentifier("btn-show-alert")

            Button("Show Confirm") {
                showConfirm = true
            }
            .accessibilityIdentifier("btn-show-confirm")

            Button("Show Sheet") {
                showSheet = true
            }
            .accessibilityIdentifier("btn-show-sheet")

            Divider()

            Text("Result: \(alertResult)")
                .accessibilityIdentifier("dialog-result")
        }
        .padding()
        .alert("Test Alert", isPresented: $showAlert) {
            Button("OK") {
                alertResult = "alert-ok"
                writeStatus("dialog:alert-ok")
            }
        } message: {
            Text("This is a test alert message.")
        }
        .alert("Confirm Action", isPresented: $showConfirm) {
            Button("Cancel", role: .cancel) {
                alertResult = "confirm-cancel"
                writeStatus("dialog:confirm-cancel")
            }
            Button("Delete", role: .destructive) {
                alertResult = "confirm-delete"
                writeStatus("dialog:confirm-delete")
            }
        } message: {
            Text("Are you sure you want to delete this item?")
        }
        .sheet(isPresented: $showSheet) {
            VStack(spacing: 16) {
                Text("Sheet Dialog")
                    .font(.title3)
                    .accessibilityIdentifier("sheet-title")

                TextField("Enter text", text: $sheetText)
                    .accessibilityIdentifier("sheet-input")
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)

                HStack {
                    Button("Cancel") {
                        showSheet = false
                        alertResult = "sheet-cancel"
                        writeStatus("dialog:sheet-cancel")
                    }
                    .accessibilityIdentifier("sheet-cancel")

                    Button("Save") {
                        showSheet = false
                        alertResult = "sheet-save:\(sheetText)"
                        writeStatus("dialog:sheet-save:\(sheetText)")
                    }
                    .accessibilityIdentifier("sheet-save")
                }
            }
            .padding(40)
        }
    }
}
