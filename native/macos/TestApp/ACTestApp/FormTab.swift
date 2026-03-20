import SwiftUI

struct FormTab: View {
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var age = ""
    @State private var agreeTerms = false
    @State private var submitted = false
    @State private var formErrors: [String] = []

    var body: some View {
        VStack(spacing: 12) {
            Text("Form Test")
                .font(.title2)
                .accessibilityIdentifier("form-title")

            Group {
                HStack {
                    Text("First Name:")
                        .frame(width: 100, alignment: .trailing)
                    TextField("First name", text: $firstName)
                        .accessibilityIdentifier("form-first-name")
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 200)
                }

                HStack {
                    Text("Last Name:")
                        .frame(width: 100, alignment: .trailing)
                    TextField("Last name", text: $lastName)
                        .accessibilityIdentifier("form-last-name")
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 200)
                }

                HStack {
                    Text("Email:")
                        .frame(width: 100, alignment: .trailing)
                    TextField("email@example.com", text: $email)
                        .accessibilityIdentifier("form-email")
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 200)
                }

                HStack {
                    Text("Age:")
                        .frame(width: 100, alignment: .trailing)
                    TextField("Age", text: $age)
                        .accessibilityIdentifier("form-age")
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 80)
                }

                Toggle("I agree to the terms", isOn: $agreeTerms)
                    .toggleStyle(.checkbox)
                    .accessibilityIdentifier("form-agree")
            }

            Divider()

            HStack {
                Button("Submit") {
                    validateAndSubmit()
                }
                .accessibilityIdentifier("form-submit")
                .disabled(!agreeTerms)

                Button("Reset") {
                    firstName = ""
                    lastName = ""
                    email = ""
                    age = ""
                    agreeTerms = false
                    submitted = false
                    formErrors = []
                    writeStatus("form:reset")
                }
                .accessibilityIdentifier("form-reset")
            }

            if submitted {
                Text("Form submitted successfully!")
                    .foregroundColor(.green)
                    .accessibilityIdentifier("form-success")
            }

            if !formErrors.isEmpty {
                VStack(alignment: .leading) {
                    ForEach(formErrors, id: \.self) { error in
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
                .accessibilityIdentifier("form-errors")
            }
        }
        .padding()
    }

    private func validateAndSubmit() {
        formErrors = []

        if firstName.isEmpty { formErrors.append("First name is required") }
        if lastName.isEmpty { formErrors.append("Last name is required") }
        if email.isEmpty || !email.contains("@") { formErrors.append("Valid email is required") }
        if age.isEmpty || Int(age) == nil { formErrors.append("Valid age is required") }

        if formErrors.isEmpty {
            submitted = true
            writeStatus("form:submitted:\(firstName):\(lastName):\(email)")
        } else {
            writeStatus("form:errors:\(formErrors.count)")
        }
    }
}
