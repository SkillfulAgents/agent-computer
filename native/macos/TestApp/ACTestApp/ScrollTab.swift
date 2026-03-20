import SwiftUI

struct ScrollTab: View {
    @State private var scrollTarget: Int? = nil

    var body: some View {
        VStack(spacing: 8) {
            Text("Scroll Test")
                .font(.title2)
                .accessibilityIdentifier("scroll-title")

            HStack {
                Button("Scroll to Top") { scrollTarget = 0 }
                    .accessibilityIdentifier("btn-scroll-top")
                Button("Scroll to Bottom") { scrollTarget = 99 }
                    .accessibilityIdentifier("btn-scroll-bottom")
                Button("Scroll to 50") { scrollTarget = 49 }
                    .accessibilityIdentifier("btn-scroll-mid")
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(0..<100, id: \.self) { i in
                            Text("Item \(i)")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(i % 2 == 0 ? Color.gray.opacity(0.1) : Color.clear)
                                .accessibilityIdentifier("scroll-item-\(i)")
                                .id(i)
                        }
                    }
                }
                .accessibilityIdentifier("scroll-list")
                .frame(height: 300)
                .border(Color.gray, width: 1)
                .onChange(of: scrollTarget) { _, target in
                    if let target = target {
                        withAnimation {
                            proxy.scrollTo(target, anchor: .top)
                        }
                    }
                }
            }
        }
        .padding()
    }
}
