import Foundation
import CoreMotion

/// Where the arm points, as sent to the screen.
/// x: yaw in degrees (+ = turned left), y: elevation in degrees (+ = up), both relative to where
/// the arm settled after it was raised. roll: palm roll (0 = palm down, 90 = thumb up).
struct Pose {
    var active: Bool
    var x: Double
    var y: Double
    var roll: Double
}

/// Turns watch motion into a pointer pose and a few big gestures.
///
/// Numbers come from recordings of the owner's own gestures.
/// 10 Nov 2026 (gentle style): swing peak 233-319 deg/s, push -0.3 g then +0.5 g, pull +0.4..0.6 g.
/// 18 Nov 2026 (in class, harder style):
///   swing   peak 340-530 deg/s; the wind-up before it 170-212; the way back 200-295
///   push    the forearm chops forward and down about 30 deg at 130-265 deg/s, reading
///           -0.4..-0.9 g and then +1.3..+2.7 g along the forearm
///   pull    +0.6..+1.3 g while the forearm comes up at 80-126 deg/s, hardly any turning
///   arm coming down: elevation falls far, with turning up to 640 deg/s
/// (Core Motion's userAcceleration reads opposite to the true acceleration.)
/// Left wrist, crown on the right: the arm hanging down reads gravity.x = +0.97, so +x points to the hand.
final class GestureEngine {
    // settings, set from the switches in the app
    var sensitivity = 1.0
    var effort = 1.0
    var swings = true
    var flings = true
    var pushPull = true
    var flipUpDown = false
    var flipPush = false
    var calibrate = false
    var trace = true            // short raw recordings around each gesture, for tuning

    var onPose: ((Pose) -> Void)?
    var onEvent: ((String, [String: Double]) -> Void)?
    var onTrace: ((String) -> Void)?

    private let motion = CMMotionManager()
    private let deg = 180.0 / Double.pi

    // arm state
    private var lastT = 0.0
    private var active = false
    private var stillFor = 0.0
    private var downFor = 0.0
    private var yaw = 0.0
    private var yaw0 = 0.0
    private var elev0 = 0.0
    private var prevElev = 0.0
    private var hasPrev = false
    private var elevRate = 0.0

    // after a gesture the ring holds still until the arm has settled, then carries on from where it was
    private var quietUntil = 0.0
    private var frozen: Pose?
    private var frozenUntil = 0.0
    private var frozenMax = 0.0
    private var calmFor = 0.0

    /// One stroke of the arm in one direction.
    private struct Track {
        var start: Double
        var dir: Double
        var travel: Double
        var peak: Double
        var pose: Pose
        var elevStart: Double
    }
    private var swing: Track?
    private var fling: Track?

    /// A finished sideways stroke that is waiting a moment to see whether it was the real swing,
    /// or only the wind-up before a stronger swing the other way.
    private struct Pending {
        var dir: Double
        var peak: Double
        var pose: Pose
        var endT: Double
    }
    private var pending: Pending?
    private var noNextUntil = 0.0
    private var noPrevUntil = 0.0
    private var strokeBlockUntil = 0.0

    /// A downward flick that is waiting a moment to see whether it was really a push.
    private var flingWait: (at: Double, v: Double, pose: Pose)?

    private var pushNegAt = -10.0
    private var pullCandAt: Double?
    private var noPushUntil = 0.0
    private var noPullUntil = 0.0

    private struct Sample {
        var t: Double
        var yawRate: Double     // signed, + = left
        var elevRate: Double    // signed, + = up
        var elev: Double
        var fwd: Double         // along the forearm, with the pull of the turn itself taken out
        var pose: Pose
    }
    private var hist: [Sample] = []

    // diagnostics
    private var dbgAt = 0.0
    private var infoAt = 0.0
    private var dYaw = 0.0, dEl = 0.0, dPush = 0.0, dPull = 0.0, dTwist = 0.0
    private var iYawP = 0.0, iYawN = 0.0, iElP = 0.0, iElN = 0.0, iFwdP = 0.0, iFwdN = 0.0, iSpin = 0.0
    private var traceDueAt = 0.0
    private var traceRestUntil = 0.0

    func start() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 50.0
        motion.startDeviceMotionUpdates(to: OperationQueue.main) { [weak self] m, _ in
            guard let self = self, let m = m else { return }
            self.step(m)
        }
    }

    func stop() {
        motion.stopDeviceMotionUpdates()
        active = false
        lastT = 0
        hasPrev = false
        stillFor = 0
        downFor = 0
        clearGestures()
        frozen = nil
        hist.removeAll()
    }

    private func clearGestures() {
        swing = nil
        fling = nil
        pending = nil
        flingWait = nil
        pullCandAt = nil
    }

    // MARK: one motion sample (50 a second, on the main thread)

    private func step(_ m: CMDeviceMotion) {
        let t = m.timestamp
        let dt = lastT > 0 ? min(0.1, max(0.001, t - lastT)) : 0.02
        lastT = t

        let g = m.gravity
        let w = m.rotationRate
        let a = m.userAcceleration
        let hand = flipUpDown ? -1.0 : 1.0

        // forearm elevation: hanging down is about -76, level is 0, pointing up is positive
        let elev = asin(max(-1.0, min(1.0, -g.x * hand))) * deg
        // palm roll: 0 palm down, 90 thumb up, about 150 palm up
        let roll = atan2(g.y * hand, -g.z) * deg
        // turning about the vertical axis, + = to the left (the same for any way of wearing the watch)
        let yawRate = -(w.x * g.x + w.y * g.y + w.z * g.z) * deg
        let spin = sqrt(w.x * w.x + w.y * w.y + w.z * w.z) * deg
        let twist = abs(w.x) * deg
        // acceleration along the forearm as Core Motion reports it
        let fwd = a.x * hand * (flipPush ? -1.0 : 1.0)

        if hasPrev {
            let raw = (elev - prevElev) / dt
            elevRate = elevRate * 0.4 + raw * 0.6
        }
        prevElev = elev
        hasPrev = true

        // a turning arm pulls along the forearm by itself (about 0.014 g per (rad/s) squared on this
        // wrist); take that out so a swing or its wind-up does not look like a pull
        let radYaw = yawRate / deg
        let radEl = elevRate / deg
        let fwdNet = fwd - 0.014 * (radYaw * radYaw + radEl * radEl)

        // raise the arm and hold it still for a moment to start; drop it to pause
        if !active {
            if elev > -30 && spin < 70 { stillFor += dt } else { stillFor = 0 }
            if stillFor >= 0.45 {
                active = true
                stillFor = 0
                downFor = 0
                yaw = 0
                yaw0 = 0
                elev0 = elev
                frozen = nil
                clearGestures()
                hist.removeAll()
                quietUntil = t + 0.8
                noPushUntil = t + 0.8
                noPullUntil = t + 0.8
            }
        } else {
            if elev < -50 { downFor += dt } else { downFor = 0 }
            if downFor >= 0.25 {
                active = false
                downFor = 0
                clearGestures()
            }
        }

        guard active else {
            onPose?(Pose(active: false, x: 0, y: 0, roll: roll))
            return
        }

        yaw += yawRate * dt
        let sens = max(0.1, sensitivity)
        var pose = Pose(active: true, x: (yaw - yaw0) * sens, y: (elev - elev0) * sens, roll: roll)

        if let fz = frozen {
            if spin < 80 { calmFor += dt } else { calmFor = 0 }
            if t < frozenUntil || (calmFor < 0.25 && t < frozenMax) {
                pose = fz
            } else {
                // the arm is back and still: carry on from where the ring was before the gesture
                yaw0 = yaw - fz.x / sens
                elev0 = elev - fz.y / sens
                frozen = nil
                pose = Pose(active: true, x: fz.x, y: fz.y, roll: roll)
            }
        }

        hist.append(Sample(t: t, yawRate: yawRate, elevRate: elevRate, elev: elev, fwd: fwdNet, pose: pose))
        while let first = hist.first, t - first.t > 1.7 { hist.removeFirst() }

        if t >= quietUntil {
            detectSwing(t: t, dt: dt, yawRate: yawRate, elev: elev, pose: pose)
        } else {
            clearGestures()
        }
        if t >= quietUntil { detectFling(t: t, dt: dt, elev: elev, pose: pose) }
        if t >= quietUntil { detectPushPull(t: t, fwd: fwd, fwdNet: fwdNet, pose: pose) }

        onPose?(pose)
        diagnostics(t: t, elev: elev, roll: roll, yawRate: yawRate, fwd: fwd, twist: twist, spin: spin)
    }

    // MARK: helpers

    /// The pose a little while ago, so a gesture can put the ring back where it was.
    private func poseBefore(_ time: Double) -> Pose? {
        var found: Pose?
        for s in hist {
            if s.t <= time { found = s.pose } else { break }
        }
        return found ?? hist.first?.pose
    }

    /// Peaks over the last `window` seconds: turning either way, forearm going up, forearm going down,
    /// and the strongest net forward reading.
    private func recent(_ t: Double, _ window: Double) -> (yaw: Double, up: Double, down: Double, fwd: Double) {
        var yawPeak = 0.0
        var up = 0.0
        var down = 0.0
        var f = 0.0
        for s in hist where t - s.t <= window {
            yawPeak = max(yawPeak, abs(s.yawRate))
            up = max(up, s.elevRate)
            down = max(down, -s.elevRate)
            f = max(f, s.fwd)
        }
        return (yawPeak, up, down, f)
    }

    private func fire(_ kind: String, _ extra: [String: Double], back: Pose, t: Double) {
        clearGestures()
        quietUntil = t + 0.9
        frozen = back
        frozenUntil = t + 0.9
        frozenMax = t + 3.0
        calmFor = 0
        var d = extra
        d["x"] = (back.x * 10).rounded() / 10
        d["y"] = (back.y * 10).rounded() / 10
        onEvent?(kind, d)
        wantTrace(t)
    }

    /// Tell the recorder why something was not counted (the screen ignores these).
    private func note(_ why: Double, _ a: Double = 0, _ b: Double = 0, t: Double) {
        guard trace else { return }
        onEvent?("note", ["w": why, "a": a.rounded(), "b": b.rounded()])
        wantTrace(t)
    }

    // MARK: swing = next / previous

    /// Swing the arm left = next section, right = previous.
    ///
    /// A swing usually comes as three strokes: a small wind-up the other way, the swing itself, and
    /// the way back. Only the strongest one may count:
    ///  - a very strong, level stroke counts at once;
    ///  - any other stroke waits a moment after it ends. If a clearly stronger stroke starts the other
    ///    way, the first one was the wind-up and is dropped;
    ///  - after a swing has counted, the opposite direction is ignored for 2.5 s (the way back).
    /// A stroke during which the forearm rises or sinks a lot is an arm being raised or put down,
    /// not a swing.
    private func detectSwing(t: Double, dt: Double, yawRate: Double, elev: Double, pose: Pose) {
        guard swings else { swing = nil; pending = nil; return }
        let r = abs(yawRate)
        let dir = yawRate >= 0 ? 1.0 : -1.0

        if var s = swing {
            if dir == s.dir && r > 40 && t - s.start < 0.9 {
                s.travel += r * dt
                s.peak = max(s.peak, r)
                swing = s
                let level = abs(elev - s.elevStart) <= 22 && elev > -20 && s.elevStart > -20
                if let p = pending, p.dir != s.dir, s.peak > p.peak * 1.1 {
                    pending = nil                      // the earlier stroke was only the wind-up
                    note(1, p.peak, s.peak, t: t)
                }
                if s.travel >= 30 && s.peak >= 330 * effort && level && elevRate > -150 {
                    pending = nil
                    countSwing(dir: s.dir, peak: s.peak, back: s.pose, t: t)
                    return
                }
            } else {
                swing = nil
                if s.travel >= 30 && s.peak >= 200 * effort {
                    let level = abs(elev - s.elevStart) <= 22 && elev > -20 && s.elevStart > -20
                    if !level {
                        note(2, s.peak, elev - s.elevStart, t: t)      // arm raised or put down
                    } else if let p = pending {
                        if p.dir == s.dir {
                            if s.peak > p.peak { pending = Pending(dir: s.dir, peak: s.peak, pose: s.pose, endT: t) }
                        } else if s.peak > p.peak * 1.1 {
                            pending = Pending(dir: s.dir, peak: s.peak, pose: s.pose, endT: t)
                            note(1, p.peak, s.peak, t: t)
                        } else {
                            pending = nil                               // this one was the way back
                            countSwing(dir: p.dir, peak: p.peak, back: p.pose, t: t)
                            return
                        }
                    } else {
                        pending = Pending(dir: s.dir, peak: s.peak, pose: s.pose, endT: t)
                    }
                }
            }
        } else if r >= 110 * effort && t >= strokeBlockUntil {
            swing = Track(start: t, dir: dir, travel: r * dt, peak: r, pose: poseBefore(t - 0.15) ?? pose, elevStart: elev)
        }

        // a waiting stroke counts after a short wait (longer for a weak one, which may be a wind-up),
        // unless a stroke the other way is still proving itself
        if let p = pending {
            let wait = p.peak < 260 * effort ? 0.18 : 0.10
            if let s = swing, s.dir != p.dir {
                if t - s.start >= 0.12 && s.peak <= p.peak * 1.1 {
                    pending = nil
                    countSwing(dir: p.dir, peak: p.peak, back: p.pose, t: t)
                }
            } else if t - p.endT >= wait {
                pending = nil
                countSwing(dir: p.dir, peak: p.peak, back: p.pose, t: t)
            }
        }
    }

    private func countSwing(dir: Double, peak: Double, back: Pose, t: Double) {
        let locked = dir > 0 ? t < noNextUntil : t < noPrevUntil
        if locked {
            // the way back after a swing: ignore it, and do not track the rest of this stroke
            swing = nil
            strokeBlockUntil = t + 0.5
            note(3, peak, t: t)
            return
        }
        if dir > 0 {
            noPrevUntil = t + 2.5
            fire("next", ["pk": peak.rounded()], back: back, t: t)
        } else {
            noNextUntil = t + 2.5
            fire("prev", ["pk": peak.rounded()], back: back, t: t)
        }
    }

    // MARK: flick = glide

    /// Flick the hand up or down = the page glides. Judged when the movement ends.
    /// Raising the arm, putting it down, and a push (which also drops the forearm) are not flicks.
    private func detectFling(t: Double, dt: Double, elev: Double, pose: Pose) {
        if let fw = flingWait, t - fw.at >= 0.10 {
            flingWait = nil
            let pk = recent(t, 0.6)
            if pushPull && pk.fwd >= 0.9 * effort && t >= noPushUntil {
                noPullUntil = t + 3.0
                fire("push", ["f": (pk.fwd * 100).rounded() / 100, "via": 2], back: fw.pose, t: t)
                return
            }
            if flings {
                fire("fling", ["v": fw.v.rounded()], back: fw.pose, t: t)
                return
            }
        }
        guard flings || pushPull else { fling = nil; return }
        let r = abs(elevRate)
        let dir = elevRate >= 0 ? 1.0 : -1.0
        if var f = fling {
            if dir == f.dir && r > 30 && t - f.start < 0.9 {
                f.travel += r * dt
                f.peak = max(f.peak, r)
                fling = f
            } else {
                fling = nil
                let pk = recent(t, 0.5)
                if f.travel >= 18 && f.peak >= 140 * effort && elev > -25 && f.elevStart > -10 && pk.yaw < 250 {
                    if f.dir < 0 {
                        flingWait = (t, f.dir * f.peak, f.pose)        // a push looks the same at first
                    } else if flings {
                        fire("fling", ["v": (f.dir * f.peak).rounded()], back: f.pose, t: t)
                    }
                }
            }
        } else if r >= 90 * effort {
            fling = Track(start: t, dir: dir, travel: r * dt, peak: r, pose: poseBefore(t - 0.15) ?? pose, elevStart: elev)
        }
    }

    // MARK: push = zoom in, pull = zoom out

    /// Push the hand toward the screen = zoom in. Pull it back = zoom out.
    /// A push reads backward and then, within 0.6 s, forward along the forearm. It may be gentle with
    /// the arm level, or a chop where the forearm drops. A pull reads forward only, with the arm calm.
    /// Neither counts while the arm is swinging, and each locks the other for 3 s (the way back).
    private func detectPushPull(t: Double, fwd: Double, fwdNet: Double, pose: Pose) {
        guard pushPull else { pullCandAt = nil; return }
        let pk = recent(t, 0.5)
        var swinging = pending != nil
        if let s = swing, s.peak >= 260 * effort { swinging = true }

        if fwd < -0.22 * effort { pushNegAt = t }

        if fwdNet > 0.30 * effort && t - pushNegAt <= 0.6 {
            let gentle = pk.yaw < 165 && pk.up < 135 && pk.down < 135
            let chop = pk.down >= 100 && pk.up < 160 && pk.yaw < 260
            if !swinging && (gentle || chop) && t >= noPushUntil {
                pushNegAt = -10
                pullCandAt = nil
                noPullUntil = t + 3.0
                fire("push", ["f": (fwdNet * 100).rounded() / 100, "via": chop ? 1 : 0], back: poseBefore(t - 0.6) ?? pose, t: t)
                return
            }
            pullCandAt = nil
            return
        }

        if let pc = pullCandAt {
            if t - pc >= 0.2 {
                pullCandAt = nil
                if !swinging && pk.yaw < 165 && pk.up < 150 && pk.down < 135 && t >= noPullUntil {
                    noPushUntil = t + 3.0
                    fire("pull", ["f": (pk.fwd * 100).rounded() / 100], back: poseBefore(t - 0.6) ?? pose, t: t)
                }
            }
        } else if fwdNet > 0.36 * effort && t >= noPullUntil && t - pushNegAt > 0.6 {
            pullCandAt = t
        }
    }

    // MARK: numbers for tuning

    /// Ask for a short raw recording (the last 1.6 s, taken 0.5 s from now), at most one every 1.5 s.
    private func wantTrace(_ t: Double) {
        guard trace, traceDueAt == 0, t >= traceRestUntil else { return }
        traceDueAt = t + 0.5
    }

    private func diagnostics(t: Double, elev: Double, roll: Double, yawRate: Double, fwd: Double, twist: Double, spin: Double) {
        dYaw = max(dYaw, abs(yawRate))
        dEl = max(dEl, abs(elevRate))
        dPush = max(dPush, -fwd)
        dPull = max(dPull, fwd)
        dTwist = max(dTwist, twist)
        iYawP = max(iYawP, yawRate)
        iYawN = min(iYawN, yawRate)
        iElP = max(iElP, elevRate)
        iElN = min(iElN, elevRate)
        iFwdP = max(iFwdP, fwd)
        iFwdN = min(iFwdN, fwd)
        iSpin = max(iSpin, spin)

        if calibrate && t - dbgAt >= 0.25 {
            dbgAt = t
            onEvent?("dbg", ["ef": effort, "yr": dYaw.rounded(), "pr": dEl.rounded(), "pu": dPush, "pl": dPull, "tw": dTwist.rounded()])
            dYaw = 0
            dEl = 0
            dPush = 0
            dPull = 0
            dTwist = 0
        } else if !calibrate {
            dYaw = 0
            dEl = 0
            dPush = 0
            dPull = 0
            dTwist = 0
        }

        if t - infoAt >= 0.5 {
            infoAt = t
            onEvent?("info", [
                "el": elev.rounded(), "ro": roll.rounded(), "yw": (yaw - yaw0).rounded(), "ef": effort,
                "yp": iYawP.rounded(), "yn": iYawN.rounded(), "pp": iElP.rounded(), "pn": iElN.rounded(),
                "fp": iFwdP, "fn": iFwdN, "sp": iSpin.rounded()
            ])
            iYawP = 0
            iYawN = 0
            iElP = 0
            iElN = 0
            iFwdP = 0
            iFwdN = 0
            iSpin = 0
        }

        // strong movement that counted as nothing is worth a recording too
        if trace && traceDueAt == 0 && (abs(yawRate) > 300 || abs(elevRate) > 200 || abs(fwd) > 0.9) { wantTrace(t) }

        if traceDueAt > 0 && t >= traceDueAt {
            traceDueAt = 0
            traceRestUntil = t + 1.5
            // every second sample (25 a second): [ms before now, yaw rate, elevation rate, elevation, net forward x100]
            var parts: [String] = []
            var i = 0
            for s in hist where t - s.t <= 1.6 {
                i += 1
                if i % 2 == 0 {
                    parts.append("[\(Int(((t - s.t) * 1000).rounded())),\(Int(s.yawRate.rounded())),\(Int(s.elevRate.rounded())),\(Int(s.elev.rounded())),\(Int((s.fwd * 100).rounded()))]")
                }
            }
            onTrace?("[" + parts.joined(separator: ",") + "]")
        }
    }
}
