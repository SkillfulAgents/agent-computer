import SwiftUI

struct ControlsTab: View {
    @State private var checkboxA = false
    @State private var checkboxB = true
    @State private var sliderValue = 50.0
    @State private var stepperValue = 0
    @State private var selectedColor = "Red"
    @State private var toggleOn = false

    let colors = ["Red", "Green", "Blue", "Yellow"]

    var body: some View {
        VStack(spacing: 16) {
            Text("Controls Test")
                .font(.title2)
                .accessibilityIdentifier("controls-title")

            HStack {
                Toggle("Option A", isOn: $checkboxA)
                    .toggleStyle(.checkbox)
                    .accessibilityIdentifier("check-a")
                Toggle("Option B", isOn: $checkboxB)
                    .toggleStyle(.checkbox)
                    .accessibilityIdentifier("check-b")
            }

            HStack {
                Toggle("Power", isOn: $toggleOn)
                    .toggleStyle(.switch)
                    .accessibilityIdentifier("toggle-power")
            }

            HStack {
                Text("Volume: \(Int(sliderValue))")
                Slider(value: $sliderValue, in: 0...100, step: 1)
                    .accessibilityIdentifier("slider-volume")
                    .frame(width: 200)
            }

            HStack {
                Text("Quantity:")
                Stepper("\(stepperValue)", value: $stepperValue, in: 0...99)
                    .accessibilityIdentifier("stepper-qty")
            }

            HStack {
                Text("Color:")
                Picker("Color", selection: $selectedColor) {
                    ForEach(colors, id: \.self) { color in
                        Text(color).tag(color)
                    }
                }
                .accessibilityIdentifier("picker-color")
                .frame(width: 150)
            }

            Divider()

            Text("Checkbox A: \(checkboxA ? "ON" : "OFF")")
                .accessibilityIdentifier("check-a-status")
            Text("Slider: \(Int(sliderValue))")
                .accessibilityIdentifier("slider-status")
            Text("Color: \(selectedColor)")
                .accessibilityIdentifier("color-status")
        }
        .padding()
        .onChange(of: checkboxA) { _, newValue in
            writeStatus("checkbox-a:\(newValue)")
        }
        .onChange(of: sliderValue) { _, newValue in
            writeStatus("slider:\(Int(newValue))")
        }
        .onChange(of: selectedColor) { _, newValue in
            writeStatus("color:\(newValue)")
        }
    }
}
