import SwiftUI

struct ContentView: View {
    @EnvironmentObject var air: AirController

    @AppStorage("effort3") private var effort = 1.0
    @AppStorage("sensitivity") private var sensitivity = 1.0
    @AppStorage("swings") private var swings = true
    @AppStorage("flings5") private var flings = true
    @AppStorage("pushPull5") private var pushPull = true
    @AppStorage("flipUpDown4") private var flipUpDown = false
    @AppStorage("flipPush") private var flipPush = false
    @State private var calibrate = false

    private var settingsKey: String {
        "\(effort)|\(sensitivity)|\(swings)|\(flings)|\(pushPull)|\(flipUpDown)|\(flipPush)|\(calibrate)"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(air.linked ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                    Text(air.status)
                        .font(.footnote)
                        .lineLimit(2)
                    Spacer()
                    Text(air.armUp ? "ON" : "PAUSED")
                        .font(.caption2)
                        .foregroundStyle(air.armUp ? Color.cyan : Color.secondary)
                }

                Button {
                    air.click()
                } label: {
                    VStack(spacing: 2) {
                        Text("Click").font(.headline)
                        Text("or double tap").font(.caption2)
                    }
                    .frame(maxWidth: .infinity)
                }
                .handGestureShortcut(.primaryAction)
                .tint(.cyan)

                Text(air.lastGesture.isEmpty ? " " : air.lastGesture)
                    .font(.title3.bold())
                    .foregroundStyle(Color.cyan)

                Divider()

                VStack(alignment: .leading, spacing: 2) {
                    Text("Gesture effort \(effort, specifier: "%.1f")×").font(.caption2)
                    Slider(value: $effort, in: 0.6...1.6, step: 0.1)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pointer speed \(sensitivity, specifier: "%.1f")×").font(.caption2)
                    Slider(value: $sensitivity, in: 0.5...2.0, step: 0.1)
                }
                Toggle("Swing: sections", isOn: $swings)
                Toggle("Flick: glide", isOn: $flings)
                Toggle("Push / pull: zoom", isOn: $pushPull)
                Toggle("Flip up/down", isOn: $flipUpDown)
                Toggle("Flip push/pull", isOn: $flipPush)
                Toggle("Calibrate", isOn: $calibrate)
            }
            .padding(.horizontal, 4)
        }
        .onAppear {
            apply()
            air.start()
        }
        .onChange(of: settingsKey) { _, _ in
            apply()
        }
    }

    private func apply() {
        let e = air.engine
        e.effort = effort
        e.sensitivity = sensitivity
        e.swings = swings
        e.flings = flings
        e.pushPull = pushPull
        e.flipUpDown = flipUpDown
        e.flipPush = flipPush
        e.calibrate = calibrate
    }
}
