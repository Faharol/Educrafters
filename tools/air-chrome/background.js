/* ETC Air · background. Holds the realtime link to the watch and passes its messages to the open tabs.
   The staff key comes from the portal's own sign-in cookie, so nothing has to be typed here. */
import { createClient } from "./ably.bundle.js";

const PORTAL = "https://smb31202-etc.netlify.app";
const ports = new Set();
let client = null, chan = null, status = "off", enabled = true, starting = false;

function broadcast(msg) { for (const p of ports) { try { p.postMessage(msg); } catch (e) {} } }
function setStatus(s) { status = s; broadcast({ status: s }); badge(); }
function badge() {
  const on = enabled && status === "connected";
  chrome.action.setBadgeText({ text: !enabled ? "OFF" : on ? "ON" : "…" });
  chrome.action.setBadgeBackgroundColor({ color: !enabled ? "#6b7c84" : on ? "#0aa3c2" : "#c98a00" });
}

async function staffKey() {
  const c = await chrome.cookies.get({ url: PORTAL + "/", name: "etc_admin" });
  if (!c || !c.value) return "";
  try { return decodeURIComponent(c.value); } catch (e) { return c.value; }
}
async function token() {
  const key = await staffKey();
  if (!key) throw new Error("nokey");
  const r = await fetch(PORTAL + "/api/remote", { method: "POST", headers: { "content-type": "application/json", "x-admin-key": key }, body: JSON.stringify({ action: "airsub" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.token) throw new Error(r.status === 401 ? "nokey" : (d.error || "Error " + r.status));
  return d;
}

async function start() {
  if (client || starting || !enabled) return;
  starting = true; setStatus("connecting");
  let first;
  try { first = await token(); } catch (e) { starting = false; setStatus(e.message === "nokey" ? "nokey" : "failed"); return; }
  let chanName = first.channel, pending = first;
  client = createClient({
    authCallback: (params, cb) => {
      const use = pending; pending = null;
      (use ? Promise.resolve(use) : token()).then((d) => { chanName = d.channel; cb(null, { token: d.token, expires: d.expires, issued: d.issued, capability: d.capability, keyName: d.keyName }); })
        .catch((e) => cb(e.message || String(e), null));
    },
    echoMessages: false,
  });
  client.connection.on("connected", () => {
    if (!chan) {
      chan = client.channels.get(chanName);
      chan.subscribe((m) => { if (ports.size && !globalThis.__airMute) broadcast({ n: m.name, d: m.data }); });
    }
    setStatus("connected");
  });
  client.connection.on("disconnected", () => setStatus("connecting"));
  client.connection.on("suspended", () => setStatus("connecting"));
  client.connection.on("failed", () => { stop(); setStatus("failed"); });
  starting = false;
}
function stop() {
  try { if (client) client.close(); } catch (e) {}
  client = null; chan = null; starting = false;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "air") return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener((m) => { if (m && m.ping && enabled && !client) start(); });
  port.postMessage({ status: enabled ? status : "off" });
  if (enabled) start();
});

chrome.action.onClicked.addListener(async () => {
  enabled = !enabled;
  await chrome.storage.local.set({ enabled });
  if (enabled) { setStatus("connecting"); start(); } else { stop(); setStatus("off"); }
});

// the portal sign-in changed: try again with the new key
chrome.cookies.onChanged.addListener((c) => {
  if (c.cookie && c.cookie.name === "etc_admin" && c.cookie.domain.indexOf("smb31202-etc") !== -1 && enabled && (status === "nokey" || status === "failed")) { stop(); start(); }
});

chrome.storage.local.get({ enabled: true }).then((v) => { enabled = v.enabled !== false; badge(); if (!enabled) status = "off"; });

// for testing from the service worker console
globalThis.__airBroadcast = broadcast;
