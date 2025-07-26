import ApplicationServices
import Cocoa

var verbose = CommandLine.arguments.contains("--verbose") || CommandLine.arguments.contains("-v")

let filteredArgs = CommandLine.arguments.filter { $0 != "--verbose" && $0 != "-v" }

// This script is used to click elements on an app (background or foreground)
// usage: click <bundleId> <elementId?>
// elementId is optional. If not provided, the script will list all elements.

let mappingFile = "/tmp/opus-ax-paths.json"

struct StandardError: TextOutputStream, Sendable {
  private static let handle = FileHandle.standardError

  public func write(_ string: String) {
    Self.handle.write(Data(string.utf8))
  }
}

var stderr = StandardError()

let axAttributes = [
  kAXRoleAttribute,
  kAXTitleAttribute,
  kAXHelpAttribute,
  kAXValueAttribute,
  kAXDescriptionAttribute,
  kAXSubroleAttribute,
]

func isClickableRole(_ role: String) -> Bool {
  let clickableRoles = [
    "AXButton",
    "AXTextField",
    "AXTextArea",
    "AXCheckBox",
    "AXRadioButton",
    "AXPopUpButton",
    "AXComboBox",
    "AXTab",
    "AXMenuItem",
    "AXCell",
    "AXSearchField",
    "AXLink",
    // "AXStaticText",
  ]
  if verbose { print("Checking if role is clickable: \(role)") }
  return clickableRoles.contains(role)
}

func elementToDictFlat(
  _ element: AXUIElement, path: [Int], flatList: inout [([Int], [String: Any])]
) {
  let attrs = axAttributes
  var dict: [String: Any] = [:]
  var isGroup = false
  var roleStr = ""
  for attr in attrs {
    var value: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(element, attr as CFString, &value)
    let str = (err == .success && value != nil) ? String(describing: value!) : ""
    if attr == kAXRoleAttribute {
      roleStr = str
      if str == "AXGroup" { isGroup = true }
    }
    dict[attr as String] = str
    if verbose {
      print("[elementToDictFlat] path=\(path) attr=\(attr) value=\(str) err=\(err.rawValue)")
    }
  }

  // let mirror = Mirror(reflecting: element)
  // let properties = mirror.children
  //
  // for property in properties {
  //   print("\(property.label!) = \(property.value)")
  // }
  // dump(element)
  // print(dict)
  var children: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
    == .success,
    let arr = children as? [AXUIElement], !arr.isEmpty
  {
    if verbose {
      print("[elementToDictFlat] path=\(path) has \(arr.count) children")
    }
    for (i, c) in arr.enumerated() { elementToDictFlat(c, path: path + [i], flatList: &flatList) }
  }
  var shouldAdd = false
  if isClickableRole(roleStr) {
    shouldAdd = true
  } else if roleStr == "AXStaticText" {
    var actionsRef: CFArray?
    if AXUIElementCopyActionNames(element, &actionsRef) == .success,
      let actions = actionsRef as? [String]
    {
      if actions.contains("AXPress") {
        shouldAdd = true
      }
      if verbose {
        print("[elementToDictFlat] path=\(path) AXStaticText actions=\(actions)")
      }
    }
  }
  if !isGroup && shouldAdd {
    if verbose {
      print("[elementToDictFlat] Adding element at path=\(path) dict=\(dict)")
    }
    flatList.append((path, dict))
  }
}

func dumpAppUI(bundleId: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.", to: &stderr)
    return
  }
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
  else {
    print("App not running: \(bundleId)", to: &stderr)
    return
  }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  if verbose {
    print("[dumpAppUI] Created AXUIElement for app pid=\(app.processIdentifier)")
  }

  // let result = AXUIElementSetAttributeValue(
  //   appElement, "AXManualAccessibility" as CFString, kCFBooleanTrue)
  // print("Setting 'AXManualAccessibility' \(result == .success ? "succeeded" : "failed")")

  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement] else {
    print("No windows", to: &stderr)
    return
  }
  if verbose {
    print("[dumpAppUI] Found \(windowList.count) windows")
  }

  var flatList: [([Int], [String: Any])] = []
  for (wIdx, w) in windowList.enumerated() {
    if verbose {
      print("[dumpAppUI] Traversing window index \(wIdx)")
    }
    // var sizeValue: CFTypeRef?
    // if AXUIElementCopyAttributeValue(w, kAXSizeAttribute as CFString, &sizeValue) == .success,
    //   let size = sizeValue as? CGSize
    // {
    //
    //   let nudgedSize = CGSize(width: size.width + 1, height: size.height)
    //   AXUIElementSetAttributeValue(w, kAXSizeAttribute as CFString, nudgedSize as CFTypeRef)
    //
    //   // Optionally revert size after a short delay
    //   DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
    //     _ = AXUIElementSetAttributeValue(w, kAXSizeAttribute as CFString, size as CFTypeRef)
    //   }
    // }
    //
    elementToDictFlat(w, path: [wIdx], flatList: &flatList)
  }

  var filteredFlatList: [([Int], [String: Any])] = []
  var seen: [String: (path: [Int], dict: [String: Any])] = [:]
  func signature(_ dict: [String: Any]) -> String {
    return axAttributes.map {
      (dict[$0 as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }.joined(separator: "|")
  }
  func filledCount(_ dict: [String: Any]) -> Int {
    dict.filter { (k, v) in
      k != "id" && k != kAXRoleAttribute as String && !(v as? String ?? "").isEmpty
    }.count
  }
  for (path, dict) in flatList {
    if let role = dict[kAXRoleAttribute as String] as? String, isClickableRole(role) {
      let sig = signature(dict)
      if let existing = seen[sig] {
        if filledCount(dict) > filledCount(existing.dict) {
          seen[sig] = (path, dict)
        }
      } else {
        seen[sig] = (path, dict)
      }
    }
  }
  for (_, v) in seen {
    if v.dict.filter({ (k, val) in
      k != "id" && k != kAXRoleAttribute as String && !(val as? String ?? "").isEmpty
    }).count > 0 {
      filteredFlatList.append((v.path, v.dict))
    }
  }
  var idToPath: [Int: [Int]] = [:]
  var flatListWithIds: [[String: Any]] = []
  for (idx, (path, dict)) in filteredFlatList.enumerated() {
    var dictWithId = dict
    dictWithId["id"] = idx
    flatListWithIds.append(dictWithId)
    idToPath[idx] = path
  }
  if let data = try? JSONSerialization.data(
    withJSONObject: flatListWithIds, options: .prettyPrinted)
  {
    if let jsonString = String(data: data, encoding: .utf8) {
      print(jsonString)
    } else {
      print("Failed to encode JSON to string", to: &stderr)
    }
  } else {
    print("Failed to serialize JSON", to: &stderr)
  }
  let idToPathStr = Dictionary(
    uniqueKeysWithValues: idToPath.map {
      (String($0.key), $0.value.map(String.init).joined(separator: "."))
    })
  if let mapData = try? JSONSerialization.data(withJSONObject: idToPathStr, options: []) {
    try? mapData.write(to: URL(fileURLWithPath: mappingFile))
    if verbose {
      print("[dumpAppUI] Wrote id-to-path mapping to \(mappingFile)")
    }
  }
}

func elementAtPath(root: AXUIElement, path: [Int]) -> AXUIElement? {
  var el = root
  for idx in path {
    var children: CFTypeRef?
    if AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &children) != .success {
      if verbose {
        print("[elementAtPath] Failed to get children at path=\(path)")
      }
      return nil
    }
    guard let arr = children as? [AXUIElement], idx < arr.count else {
      if verbose {
        print("[elementAtPath] Invalid child index \(idx) at path=\(path)")
      }
      return nil
    }
    el = arr[idx]
  }
  if verbose {
    print("[elementAtPath] Found element at path=\(path)")
  }
  return el
}

func clickElementById(bundleId: String, idStr: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.", to: &stderr)
    return
  }
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
  else {
    print("App not running: \(bundleId)", to: &stderr)
    return
  }
  guard let id = Int(idStr) else {
    print(
      "Invalid id. The ID must be an integer. Do not give a description of the element.",
      to: &stderr)
    return
  }
  guard let mapData = try? Data(contentsOf: URL(fileURLWithPath: mappingFile)),
    let mapObj = try? JSONSerialization.jsonObject(with: mapData) as? [String: String],
    let pathStr = mapObj["\(id)"]
  else {
    print("Mapping file or id not found", to: &stderr)
    return
  }
  let comps = pathStr.split(separator: ".").compactMap { Int($0) }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement], let wIdx = comps.first, wIdx < windowList.count
  else {
    print("Invalid window index", to: &stderr)
    return
  }
  let el = elementAtPath(root: windowList[wIdx], path: Array(comps.dropFirst()))
  if let el = el {
    if verbose {
      print("[clickElementById] Performing AXPress on element id=\(id) path=\(comps)")
    }
    AXUIElementPerformAction(el, kAXPressAction as CFString)
    print("Clicked element id \(id)")
  } else {
    print(
      "Element not found for id \(id). Make sure you use an element from the list given",
      to: &stderr)
  }
}

let bundleId = filteredArgs.count > 1 ? filteredArgs[1] : nil
let idStr = filteredArgs.count > 2 ? filteredArgs[2] : nil

if verbose {
  print("[main] Arguments: \(CommandLine.arguments)")
  print("[main] Filtered arguments: \(filteredArgs)")
}
if let b = bundleId, idStr == nil {
  // print("trusted status")
  // print(AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": true] as CFDictionary))
  dumpAppUI(bundleId: b)
} else if let b = bundleId, let i = idStr {
  clickElementById(bundleId: b, idStr: i)
} else {
  print("Usage: swift swift/click.swift <bundleId> <elementId?> [--verbose]", to: &stderr)
}
