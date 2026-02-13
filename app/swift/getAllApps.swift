import Foundation

let fileManager = FileManager.default
let appDirectories = [
    "/Applications",
    "/System/Applications",
    "\(NSHomeDirectory())/Applications"
]

for dir in appDirectories {
    if let apps = try? fileManager.contentsOfDirectory(atPath: dir) {
        for app in apps where app.hasSuffix(".app") {
            let appName = String(app.dropLast(4)) // Remove ".app" extension
            print(appName)
        }
    }
}
