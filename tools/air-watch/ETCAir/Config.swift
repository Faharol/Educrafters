import Foundation

/// Personal settings for this watch. Keep this folder private: the key lets a watch drive your screen.
enum Config {
    static let baseURL = "https://smb31202-etc.netlify.app"
    static let watchKey = "PUT-YOUR-WATCH-KEY-HERE"   // the personal watch key issued by /api/remote action "watchkey" (owner only). Never commit the real key.
}
