import Foundation

/// Talks to the portal (for a short-lived token) and to Ably (to publish the motion stream).
/// Everything here is called on the main thread; network replies hop back to it.
final class AirLink {
    var onStatus: ((String, Bool) -> Void)?
    private(set) var ready = false

    private var token = ""          // already base64 encoded for the Authorization header
    private var channelPath = ""
    private var expiresAt = 0.0     // seconds since 1970
    private var fetching = false
    private var fails = 0
    private var waiters: [(Bool) -> Void] = []
    private let http: URLSession

    init() {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 8
        c.waitsForConnectivity = false
        c.httpMaximumConnectionsPerHost = 4
        http = URLSession(configuration: c)
    }

    /// Ask the portal for a publish-only token for this watch's channel.
    func connect(_ done: ((Bool) -> Void)? = nil) {
        if let done = done { waiters.append(done) }
        guard !fetching else { return }
        guard let url = URL(string: Config.baseURL + "/api/remote") else { return }
        fetching = true
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["action": "airtoken", "key": Config.watchKey])
        http.dataTask(with: req) { data, _, _ in
            let reply = AirLink.read(data)
            let tok = reply.token
            let chan = reply.channel
            let exp = reply.expires
            let msg = reply.message
            DispatchQueue.main.async {
                self.fetching = false
                let ok = !tok.isEmpty && !chan.isEmpty
                if ok {
                    self.token = Data(tok.utf8).base64EncodedString()
                    self.channelPath = chan.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? chan
                    self.expiresAt = exp > 0 ? exp : Date().timeIntervalSince1970 + 3600
                    self.ready = true
                    self.fails = 0
                    self.onStatus?("Linked", true)
                } else {
                    self.ready = false
                    self.onStatus?(msg, false)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) { self.connect() }
                }
                let w = self.waiters
                self.waiters = []
                for f in w { f(ok) }
            }
        }.resume()
    }

    private static func read(_ data: Data?) -> (token: String, channel: String, expires: Double, message: String) {
        guard let data = data, let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return ("", "", 0, "No connection")
        }
        let tok = o["token"] as? String ?? ""
        let chan = o["channel"] as? String ?? ""
        let exp = (o["expires"] as? Double ?? 0) / 1000.0
        let msg = o["error"] as? String ?? "No connection"
        return (tok, chan, exp, msg)
    }

    /// Publish one message. `json` is sent as a string; the screen parses it.
    func publish(_ name: String, _ json: String, retry: Bool = false, done: ((Bool) -> Void)? = nil) {
        guard ready, let url = URL(string: "https://rest.ably.io/channels/\(channelPath)/messages") else {
            done?(false)
            return
        }
        if Date().timeIntervalSince1970 > expiresAt - 300 { connect() }   // renew a little early
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["name": name, "data": json])
        http.dataTask(with: req) { _, resp, _ in
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            DispatchQueue.main.async {
                let ok = code >= 200 && code < 300
                if ok {
                    if self.fails >= 5 { self.onStatus?("Linked", true) }
                    self.fails = 0
                } else {
                    self.fails += 1
                    if code == 401 {
                        self.ready = false
                        self.onStatus?("Reconnecting…", false)
                        self.connect()
                    } else if self.fails == 5 {
                        self.onStatus?("Weak signal", false)
                    }
                }
                if !ok && retry {
                    self.publish(name, json, retry: false, done: done)
                } else {
                    done?(ok)
                }
            }
        }.resume()
    }
}
