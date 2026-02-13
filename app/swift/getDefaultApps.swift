import Foundation
import CoreServices
import AppKit

let schemes = ["http", "https", "mailto", "ftp", "tel"]
let utis = [
    "public.jpeg",      // .jpg
    "public.png",       // .png
    "public.html",      // .html
    "public.text",      // .txt
    "com.adobe.pdf",    // .pdf
    "public.mp3",       // .mp3
    "public.mpeg-4"     // .mp4
]

func appPath(for bundleID: String) -> String {
    if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
        return url.path
    }
    return "(Not found)"
}

print("=== Default Apps for URL Schemes ===")
for scheme in schemes {
    if let handler = LSCopyDefaultHandlerForURLScheme(scheme as CFString)?.takeRetainedValue() {
        print("\(scheme): \(handler) — \(appPath(for: handler as String))")
    } else {
        print("\(scheme): No default handler")
    }
}

print("\n=== Default Apps for File Types (UTIs) ===")
for uti in utis {
    if let handler = LSCopyDefaultRoleHandlerForContentType(uti as CFString, .all)?.takeRetainedValue() {
        print("\(uti): \(handler) — \(appPath(for: handler as String))")
    } else {
        print("\(uti): No default handler")
    }
}
