import SwiftUI

struct TextInputTab: View {
    @State private var singleLine = ""
    @State private var multiLine = ""
    @State private var searchField = ""
    @State private var passwordField = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("Text Input Test")
                .font(.title2)
                .accessibilityIdentifier("text-title")

            HStack {
                Text("Name:")
                TextField("Enter your name", text: $singleLine)
                    .accessibilityIdentifier("input-name")
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)
            }

            HStack {
                Text("Search:")
                TextField("Search...", text: $searchField)
                    .accessibilityIdentifier("input-search")
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)
            }

            HStack {
                Text("Password:")
                SecureField("Password", text: $passwordField)
                    .accessibilityIdentifier("input-password")
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 200)
            }

            VStack(alignment: .leading) {
                Text("Notes:")
                TextEditor(text: $multiLine)
                    .accessibilityIdentifier("input-notes")
                    .frame(height: 100)
                    .border(Color.gray, width: 1)
            }

            Divider()

            Text("Name value: \(singleLine)")
                .accessibilityIdentifier("name-value")
            Text("Character count: \(multiLine.count)")
                .accessibilityIdentifier("char-count")

            Button("Clear All") {
                singleLine = ""
                multiLine = ""
                searchField = ""
                passwordField = ""
                writeStatus("text:cleared")
            }
            .accessibilityIdentifier("btn-clear-text")
        }
        .padding()
    }
}
