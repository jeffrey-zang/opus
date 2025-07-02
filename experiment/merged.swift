import ApplicationServices
import Cocoa

var elementMap: [Int: AXUIElement] = [:]
var elementInfo: [Int: [String: Any]] = [:]
var currentId = 0

func getAllAttributes(_ element: AXUIElement) -> [String: Any] {
  var dict: [String: Any] = [:]
  var attrNames: CFArray?
  let attrErr = AXUIElementCopyAttributeNames(element, &attrNames)
  if attrErr == .success, let names = attrNames as? [String] {
    for name in names {
      var value: CFTypeRef?
      let valueErr = AXUIElementCopyAttributeValue(element, name as CFString, &value)
      if valueErr == .success, let v = value {
        dict[name] = String(describing: v)
      } else {
        dict[name] = "<unavailable>"
      }
    }
  }
  return dict
}

func assignIdsFlat(_ element: AXUIElement) {
  var role: CFTypeRef?
  var isGroup = false
  let roleErr = AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
  if roleErr == .success, let r = role as? String, r == "AXGroup" {
    isGroup = true
  }
  var children: CFTypeRef?
  let err = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
  if err == .success, let childrenArray = children as? [AXUIElement], !childrenArray.isEmpty {
    for child in childrenArray {
      assignIdsFlat(child)
    }
  }
  if !isGroup {
    let id = currentId
    elementMap[id] = element
    elementInfo[id] = getAllAttributes(element)
    currentId += 1
  }
}

func printElementMap(limit: Int = 5) {
  for (id, attrs) in elementInfo.sorted(by: { $0.key < $1.key }).prefix(limit) {
    let info = attrs.map { "\($0): \($1)" }.joined(separator: ", ")
    print("[\(id)] \(info)")
  }
}

func saveElementInfoToJson(limit: Int = 5) {
  let arr = elementInfo.sorted(by: { $0.key < $1.key }).map {
    (id, attrs) -> [String: Any] in
    var dict: [String: Any] = ["id": id]
    for (k, v) in attrs { dict[k] = v }
    return dict
  }
  if let data = try? JSONSerialization.data(withJSONObject: arr, options: [.prettyPrinted]),
    let url = URL(string: "file://" + FileManager.default.currentDirectoryPath + "/output.json")
  {
    try? data.write(to: url)
    print("Saved to output.json")
  } else {
    print("Failed to serialize or save JSON")
  }
}

func clickElementById(_ id: Int) {
  guard let element = elementMap[id] else {
    print("No element for id \(id)")
    return
  }
  AXUIElementPerformAction(element, kAXPressAction as CFString)
  print("Clicked element \(id)")
}

func run(bundleId: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app in System Preferences.")
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
    print("No windows found")
    return
  }
  for window in windowList {
    assignIdsFlat(window)
  }
  // printElementMap(limit: 5)
  saveElementInfoToJson()
}

// Example usage:
run(bundleId: "com.hnc.Discord")
clickElementById(6)
