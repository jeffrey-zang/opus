import ApplicationServices
import Cocoa

// usage: click <bundleId> <elementId>
// elementId is optional. If not provided, the script will list all elements.

var elementIdCounter = 0

func elementToDictFlat(_ element: AXUIElement, flatList: inout [[String: Any]]) {
  let attrs = [
    kAXRoleAttribute, kAXRoleDescriptionAttribute, kAXDescriptionAttribute,
    kAXTitleAttribute, kAXSubroleAttribute, kAXHelpAttribute,
    kAXValueAttribute, kAXURLAttribute,
  ]
  var dict: [String: Any] = [:]
  dict["id"] = elementIdCounter
  elementIdCounter += 1
  var isGroup = false
  for attr in attrs {
    var value: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(element, attr as CFString, &value)
    let str = (err == .success && value != nil) ? String(describing: value!) : ""
    if attr == kAXRoleAttribute && str == "AXGroup" { isGroup = true }
    if !str.isEmpty { dict[attr as String] = str }
  }
  var children: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    == .success,
    let arr = children as? [AXUIElement], !arr.isEmpty
  {
    for c in arr { elementToDictFlat(c, flatList: &flatList) }
  }
  if !isGroup { flatList.append(dict) }
}

func dumpAppUI(bundleId: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.")
    return
  }
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
  else {
    print("App not running: \(bundleId)")
    return
  }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement] else {
    print("No windows")
    return
  }
  var flatList: [[String: Any]] = []
  for w in windowList { elementToDictFlat(w, flatList: &flatList) }
  if let data = try? JSONSerialization.data(withJSONObject: flatList, options: .prettyPrinted) {
    if let jsonString = String(data: data, encoding: .utf8) {
      print(jsonString)
    } else {
      print("Failed to encode JSON to string")
    }
  } else {
    print("Failed to serialize JSON")
  }
}

let bundleId = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : nil
if let b = bundleId { dumpAppUI(bundleId: b) } else { print("Usage: dump <bundleId>") }
