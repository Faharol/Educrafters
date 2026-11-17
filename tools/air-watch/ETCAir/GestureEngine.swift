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
/// Thresholds come from a recording of the owner's own gestures (10 Nov 2026):
///   swing  peak 233-319 deg/s over 60-80 deg, the way back stays under 144
///   flick  up 135-217, down 170-228 deg/s over 27-41 deg, the way back stays under 122
///   push   reads -0.28..-0.37 g and then +0.45..+0.60 g along the forearm
///   pull   reads +0.38..+0.58 g
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

    var onPose: ((Pose) -> Void)?
    var onEvent: ((String, [String: Double]) -> Void)?

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

    // after a gesture the ring holds still, then carries on from where it was
    private var quietUntil = 0.0
    private var frozen: Pose?
    private var frozenUntil = 0.0

    private struct Track {
        var start: Double
        var dir: Double
        var travel: Double
        var peak: Double
        var pose: Pose
    }
    private var swing: Track?
    private var fling: Track?

    private var pushNegAt = -10.0
    private var pullCandAt: Double?
    private var noPushUntil = 0.0
    private var noPullUntil = 0.0

    private struct Sample {
        var t: Double
        var yawRate: Double
        var elevRate: Double
        var pose: Pose
    }
    private var hist: [Sample] = []

    // diagnostics
    private var dbgAt = 0.0
    private var infoAt = 0.0
    private var dYaw = 0.0, dEl = 0.0, dPush = 0.0, dPull = 0.0, dTwist = 0.0
    private var iYawP = 0.0, iYawN = 0.0, iElP = 0.0, iElN = 0.0, iFwdP = 0.0, iFwdN = 0.0, iSpin = 0.0

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
                swing = nil
                fling = nil
                pullCandAt = nil
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
            if t < frozenUntil {
                pose = fz
            } else {
                // carry on from where the ring was before the gesture
                yaw0 = yaw - fz.x / sens
                elev0 = elev - fz.y / sens
                frozen = nil
                pose = Pose(active: true, x: fz.x, y: fz.y, roll: roll)
            }
        }

        hist.append(Sample(t: t, yawRate: abs(yawRate), elevRate: abs(elevRate), pose: pose))
        while let first = hist.first, t - first.t > 1.0 { hist.removeFirst() }

        if t >= quietUntil {
            detectSwing(t: t, dt: dt, yawRate: yawRate, pose: pose)
        } else {
            swing = nil
            fling = nil
            pullCandAt = nil
        }
        if t >= quietUntil { detectFling(t: t, dt: dt, elev: elev, pose: pose) }
        if t >= quietUntil { detectPushPull(t: t, fwd: fwd, pose: pose) }

        onPose?(pose)
        diagnostics(t: t, elev: elev, roll: roll, yawRate: yawRate, fwd: fwd, twist: twist, spin: spin)
    }

    // MARK: gestures

    /// The pose a little while ago, so a gesture can put the ring back where it was.
    private func poseBefore(_ time: Double) -> Pose? {
        var found: Pose?
        for s in hist {
            if s.t <= time { found = s.pose } else { break }
        }
        return found ?? hist.first?.pose
    }

    private func fire(_ kind: String, _ extra: [String: Double], back: Pose, t: Double) {
        swing = nil
        fling = nil
        pullCandAt = nil
        quietUntil = t + 0.9
        frozen = back
        frozenUntil = t + 0.9
        var d = extra
        d["x"] = (back.x * 10).rounded() / 10
        d["y"] = (back.y * 10).rounded() / 10
        onEvent?(kind, d)
    }

    /// Swing the arm left = next section, right = previous.
    private func detectSwing(t: Double, dt: Double, yawRate: Double, pose: Pose) {
        guard swings else { swing = nil; return }
        let r = abs(yawRate)
        let dir = yawRate >= 0 ? 1.0 : -1.0
        if var s = swing {
            if dir == s.dir && r > 40 && t - s.start < 0.9 {
                s.travel += r * dt
                s.peak = max(s.peak, r)
                swing = s
                if s.travel >= 30 && s.peak >= 200 * effort {
                    fire(s.dir > 0 ? "next" : "prev", [:], back: s.pose, t: t)
                }
            } else {
                swing = nil
            }
        } else if r >= 110 * effort {
            swing = Track(start: t, dir: dir, travel: r * dt, peak: r, pose: poseBefore(t - 0.15) ?? pose)
        }
    }

    /// Flick the hand up or down = the page glides. Judged when the movement ends.
    private func detectFling(t: Double, dt: Double, elev: Double, pose: Pose) {
        guard flings else { fling = nil; return }
        let r = abs(elevRate)
        let dir = elevRate >= 0 ? 1.0 : -1.0
        if var f = fling {
            if dir == f.dir && r > 30 && t - f.start < 0.9 {
                f.travel += r * dt
                f.peak = max(f.peak, r)
                fling = f
            } else {
                fling = nil
                if f.travel >= 18 && f.peak >= 140 * effort && elev > -42 {
                    fire("fling", ["v": (f.dir * f.peak).rounded()], back: f.pose, t: t)
                }
            }
        } else if r >= 90 * effort {
            fling = Track(start: t, dir: dir, travel: r * dt, peak: r, pose: poseBefore(t - 0.15) ?? pose)
        }
    }

    /// Push the hand toward the screen = zoom in, pull it back = zoom out.
    /// The forearm must not be swinging or flicking at the same time.
    private func detectPushPull(t: Double, fwd: Double, pose: Pose) {
        guard pushPull else { pullCandAt = nil; return }
        var yawPeak = 0.0
        var elevPeak = 0.0
        for s in hist where t - s.t <= 0.5 {
            yawPeak = max(yawPeak, s.yawRate)
            elevPeak = max(elevPeak, s.elevRate)
        }
        let calm = yawPeak < 190 && elevPeak < 135

        if fwd < -0.22 * effort { pushNegAt = t }

        if fwd > 0.30 * effort && t - pushNegAt <= 0.6 {
            pushNegAt = -10
            pullCandAt = nil
            if calm && t >= noPushUntil {
                noPullUntil = t + 3.0
                fire("push", [:], back: poseBefore(t - 0.6) ?? pose, t: t)
            }
            return
        }

        if let pc = pullCandAt {
            if t - pc >= 0.2 {
                pullCandAt = nil
                if calm && t >= noPullUntil {
                    noPushUntil = t + 3.0
                    fire("pull", [:], back: poseBefore(t - 0.6) ?? pose, t: t)
                }
            }
        } else if fwd > 0.36 * effort && t >= noPullUntil && t - pushNegAt > 0.6 {
            pullCandAt = t
        }
    }

    // MARK: numbers for tuning

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
    }
}
