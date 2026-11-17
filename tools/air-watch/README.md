# ETC Air: control the projector with hand gestures (Apple Watch Ultra 2)

Rebuilt on 18 Nov 2026 from the design notes, after the original folder was deleted.
Keep this folder somewhere safe (not Downloads). `ETCAir/Config.swift` holds your personal watch key.

## The gestures

| Do this | Happens on the screen |
|---|---|
| Raise your arm and hold still for half a second | The ring appears in the middle |
| Palm down, move your hand | The ring follows and locks onto buttons near it |
| Double tap (thumb and index finger, twice) | Click the locked target. On empty space: zoom in, again to zoom out |
| Turn your thumb up, move the hand up / down | Scroll (slow, and it rests after each scroll) |
| Swing your arm left / right | Next / previous section |
| Push your hand toward the screen / pull it back | Zoom in / out |
| Flick the hand up / down | The page glides a little |
| Drop your arm | Pause |

In the app: **Gesture effort** (lower = easier), **Pointer speed**, switches for each gesture,
**Flip up/down** if the ring moves the wrong way, **Calibrate** to show gesture strength on the screen.

## Install or renew (every 7 days with a free Apple ID)

1. Connect the iPhone to the Mac by cable and unlock it. Wear the watch, unlocked.
2. Double-click `ETCAir.xcodeproj`.
3. First time only: click the blue **ETCAir** icon (top left) > target **ETCAir** > **Signing & Capabilities** > **Team** > your Personal Team.
4. At the top of Xcode choose your **Apple Watch**, then press **Run**.
5. The watch opens ETC Air and shows **Linked**.

## Chrome extension (other websites)

`ETCAir-Chrome` in this folder. In Chrome: `chrome://extensions` > Developer mode > **Load unpacked** > choose `ETCAir-Chrome`.
Stay signed in to the ETC Lab admin in the same Chrome.
