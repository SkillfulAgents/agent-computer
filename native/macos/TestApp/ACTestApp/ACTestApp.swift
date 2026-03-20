import SwiftUI

@main
struct ACTestAppApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(minWidth: 600, minHeight: 500)
        }
        .windowResizability(.contentSize)
    }
}

struct ContentView: View {
    var body: some View {
        TabView {
            ButtonsTab()
                .tabItem { Label("Buttons", systemImage: "hand.tap") }
            TextInputTab()
                .tabItem { Label("Text Input", systemImage: "text.cursor") }
            ControlsTab()
                .tabItem { Label("Controls", systemImage: "slider.horizontal.3") }
            ScrollTab()
                .tabItem { Label("Scroll", systemImage: "scroll") }
            FormTab()
                .tabItem { Label("Form", systemImage: "doc.text") }
            AsyncTab()
                .tabItem { Label("Async", systemImage: "clock") }
            DialogsTab()
                .tabItem { Label("Dialogs", systemImage: "exclamationmark.triangle") }
        }
        .padding()
    }
}
