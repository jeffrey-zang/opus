import ApplicationServices
import Cocoa

// This script is used to click elements on an app (background or foreground)
// usage: click <bundleId> <elementId?>
// elementId is optional. If not provided, the script will list all elements.

let mappingFile = "/tmp/opus-ax-paths.json"

func elementToDictFlat(_ element: AXUIElement, path: [Int], idCounter: inout Int, flatList: inout [[String: Any]], idToPath: inout [Int: [Int]]) {
  let attrs = [
    kAXRoleAttribute, kAXRoleDescriptionAttribute, kAXDescriptionAttribute,
    kAXTitleAttribute, kAXSubroleAttribute, kAXHelpAttribute,
    kAXValueAttribute, kAXURLAttribute,
  ]
  var dict: [String: Any] = [:]
  let id = idCounter
  dict["id"] = id
  idToPath[id] = path
  idCounter += 1
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
    for (i, c) in arr.enumerated() { elementToDictFlat(c, path: path + [i], idCounter: &idCounter, flatList: &flatList, idToPath: &idToPath) }
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
  var idToPath: [Int: [Int]] = [:]
  var idCounter = 0
  for (wIdx, w) in windowList.enumerated() { elementToDictFlat(w, path: [wIdx], idCounter: &idCounter, flatList: &flatList, idToPath: &idToPath) }
  if let data = try? JSONSerialization.data(withJSONObject: flatList, options: .prettyPrinted) {
    if let jsonString = String(data: data, encoding: .utf8) {
      print(jsonString)
    } else {
      print("Failed to encode JSON to string")
    }
  } else {
    print("Failed to serialize JSON")
  }
  let idToPathStr = Dictionary(uniqueKeysWithValues: idToPath.map { (String($0.key), $0.value.map(String.init).joined(separator: ".")) })
  if let mapData = try? JSONSerialization.data(withJSONObject: idToPathStr, options: []) {
    try? mapData.write(to: URL(fileURLWithPath: mappingFile))
  }
}

func elementAtPath(root: AXUIElement, path: [Int]) -> AXUIElement? {
  var el = root
  for idx in path {
    var children: CFTypeRef?
    if AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &children) != .success {
      return nil
    }
    guard let arr = children as? [AXUIElement], idx < arr.count else { return nil }
    el = arr[idx]
  }
  return el
}

func clickElementById(bundleId: String, idStr: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.")
    return
  }
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
    print("App not running: \(bundleId)")
    return
  }
  guard let id = Int(idStr) else {
    print("Invalid id")
    return
  }
  guard let mapData = try? Data(contentsOf: URL(fileURLWithPath: mappingFile)),
        let mapObj = try? JSONSerialization.jsonObject(with: mapData) as? [String: String],
        let pathStr = mapObj["\(id)"] else {
    print("Mapping file or id not found")
    return
  }
  let comps = pathStr.split(separator: ".").compactMap { Int($0) }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement], let wIdx = comps.first, wIdx < windowList.count else {
    print("Invalid window index")
    return
  }
  let el = elementAtPath(root: windowList[wIdx], path: Array(comps.dropFirst()))
  if let el = el {
    AXUIElementPerformAction(el, kAXPressAction as CFString)
    print("Clicked element id \(id)")
  } else {
    print("Element not found for id \(id)")
  }
}

let bundleId = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : nil
let idStr = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : nil

if let b = bundleId, idStr == nil {
  dumpAppUI(bundleId: b)
} else if let b = bundleId, let i = idStr {
  clickElementById(bundleId: b, idStr: i)
} else {
  print("Usage: swift swift/click.swift <bundleId> <elementId?>")
}