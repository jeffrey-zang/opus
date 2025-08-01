import Foundation
import AppKit

if let url = URL(string: "http://example.com"),
   let browserURL = NSWorkspace.shared.urlForApplication(toOpen: url) {
    print(browserURL.lastPathComponent)
}
