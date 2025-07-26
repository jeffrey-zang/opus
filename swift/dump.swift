import ApplicationServices
import Cocoa

let args = CommandLine.arguments
if args.count < 2 {
  print("Usage: swift dump.swift <bundleId>")
  exit(1)
}
let bundleId = args[1]

guard AXIsProcessTrusted() else {
  print("Enable Accessibility permissions for this app.")
  exit(1)
}
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
  print("App not running: \(bundleId)")
  exit(1)
}
let appElement = AXUIElementCreateApplication(app.processIdentifier)

func printElement(_ element: AXUIElement, indent: String = "") {
  var role: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
  let roleStr = (role as? String) ?? "?"
  print("\(indent)Role: \(roleStr)")
  var children: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children) == .success,
     let arr = children as? [AXUIElement], !arr.isEmpty {
    for c in arr {
      printElement(c, indent: indent + "  ")
    }
  }
}

var windows: CFTypeRef?
AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
if let windowList = windows as? [AXUIElement] {
  for w in windowList {
    printElement(w)
  }
} else {
  print("No windows found.")
} 