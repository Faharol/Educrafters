import Foundation
import SwiftUI
import WatchKit

/// Glue: motion engine -> realtime link, plus haptics and keeping the app awake in class.
final class AirController: NSObject, ObservableObject, WKExtendedRuntimeSessionDelegate {
    @Published var status = "Connecting…"
    @Published var linked = false
    @Published var armUp = false
    @Published var lastGesture = ""
    @Published var enabled = true     // the big ON / OFF button

    let engine = GestureEngine()
    private let link = AirLink()
    private var runtime: WKExtendedRuntimeSession?
    private var started = false
    private var seq: Int64 = 0
    private var latest: Pose?
    private var inFlight = 0
    private var lastSentAt = 0.0
    private var lastSentActive = false
    private var clearLabel: DispatchWorkItem?

    override init() {
        super.init()
        link.onStatus = { [weak self] text, ok in
            self?.status = text
            self?.linked = ok
        }
        engine.onPose = { [weak self] p in self?.pose(p) }
        engine.onEvent = { [weak self] k, d in self?.event(k, d) }
        engine.onTrace = { [weak self] rows in self?.trace(rows) }
    }

    /// Safe to call again and again (app opened, wrist raised).
    func start() {
        if !started {
            started = true
            if enabled { engine.start() }
            link.connect { [weak self] ok in
                if ok { self?.event("hello", [:]) }
            }
        }
        keepAwake()
    }

    func click() {
        guard enabled else { return }
        event("click", [:])
    }

    /// OFF: the watch stops reading the arm and the ring leaves the screen. ON: back to normal.
    func setEnabled(_ on: Bool) {
        guard on != enabled else { return }
        enabled = on
        WKInterfaceDevice.current().play(on ? .start : .stop)
        if on {
            engine.start()
        } else {
            engine.stop()
            armUp = false
            lastGesture = ""
            latest = Pose(active: false, x: 0, y: 0, roll: 0)
            lastSentActive = true      // send the "arm down" pose now, not at the next heartbeat
            inFlight = 0
            pump()
            latest = nil
        }
    }

    // MARK: staying awake (Info.plist: WKBackgroundModes = mindfulness)

    private func keepAwake() {
        if let r = runtime, r.state != .invalid { return }
        let r = WKExtendedRuntimeSession()
        r.delegate = self
        r.start()
        runtime = r
    }

    func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}

    func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}

    func extendedRuntimeSession(_ extendedRuntimeSession: WKExtendedRuntimeSession,
                                didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
                                error: Error?) {
        DispatchQueue.main.async {
            if self.runtime === extendedRuntimeSession { self.runtime = nil }
        }
    }

    // MARK: sending

    private func nextSeq() -> Int64 {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        seq = max(seq + 1, now)
        return seq
    }

    private func num(_ v: Double, _ places: Int = 2) -> String {
        guard v.isFinite else { return "0" }
        if v == v.rounded() && abs(v) < 1e15 { return String(Int64(v)) }
        return String(format: "%.\(places)f", v)
    }

    private func pose(_ p: Pose) {
        guard enabled else { return }
        if p.active != armUp { armUp = p.active }
        latest = p
        pump()
    }

    /// Poses go out at about 12 a second while the arm is up, and as a slow heartbeat otherwise.
    private func pump() {
        guard link.ready, let p = latest else { return }
        let now = ProcessInfo.processInfo.systemUptime
        let gap = p.active ? 0.08 : (lastSentActive ? 0.0 : 3.0)
        guard inFlight < 3, now - lastSentAt >= gap else { return }
        lastSentAt = now
        lastSentActive = p.active
        inFlight += 1
        let json = "{\"s\":\(nextSeq()),\"a\":\(p.active ? 1 : 0),\"m\":0,\"r\":\(num(p.roll.rounded())),\"x\":\(num(p.x)),\"y\":\(num(p.y))}"
        link.publish("p", json) { [weak self] _ in
            guard let self = self else { return }
            self.inFlight = max(0, self.inFlight - 1)
        }
    }

    /// A short raw recording around a gesture, for tuning. The screen ignores it.
    private func trace(_ rows: String) {
        guard enabled else { return }
        link.publish("e", "{\"s\":\(nextSeq()),\"k\":\"raw\",\"d\":\(rows)}")
    }

    private func event(_ k: String, _ d: [String: Double]) {
        if !enabled && k != "hello" { return }
        var json = "{\"s\":\(nextSeq()),\"k\":\"\(k)\""
        for (key, v) in d { json += ",\"\(key)\":\(num(v))" }
        json += "}"
        let quiet = (k == "dbg" || k == "info" || k == "note")
        link.publish("e", json, retry: !quiet)
        if quiet || k == "hello" { return }

        let device = WKInterfaceDevice.current()
        var label = ""
        switch k {
        case "click": device.play(.click); label = "Click"
        case "next": device.play(.directionUp); label = "Next ›"
        case "prev": device.play(.directionDown); label = "‹ Previous"
        case "push": device.play(.start); label = "Zoom in"
        case "pull": device.play(.stop); label = "Zoom out"
        case "fling": device.play(.click); label = (d["v"] ?? 0) > 0 ? "Flick up" : "Flick down"
        default: break
        }
        lastGesture = label
        clearLabel?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.lastGesture = "" }
        clearLabel = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2, execute: w)
    }
}
