import SwiftUI

@main
struct ETCAirApp: App {
    @StateObject private var air = AirController()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(air)
        }
        .onChange(of: phase) { _, now in
            if now == .active { air.start() }
        }
    }
}
