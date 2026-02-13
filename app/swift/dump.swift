import ApplicationServices
import Cocoa

// Unreadable dump of all elements given an app's bundle id
// Usage: swift dump.swift <bundleId> [--verbose / -v]

var verbose = CommandLine.arguments.contains("--verbose") || CommandLine.arguments.contains("-v")

let filteredArgs = CommandLine.arguments.filter { $0 != "--verbose" && $0 != "-v" }

let mappingFile = "/tmp/opus-ax-paths.json"

struct StandardError: TextOutputStream, Sendable {
  private static let handle = FileHandle.standardError

  public func write(_ string: String) {
    Self.handle.write(Data(string.utf8))
  }
}

var stderr = StandardError()

// Reduced attribute set - only query what we need for clickable elements
let essentialAttributes = [
  kAXRoleAttribute,
  kAXTitleAttribute,
  kAXValueAttribute,
  kAXDescriptionAttribute
]

let detailedAttributes = [
  kAXHelpAttribute,
  kAXSubroleAttribute,
  kAXRoleDescriptionAttribute,
  kAXPlaceholderValueAttribute
]

let clickableRoles: Set<String> = [
  "AXButton",
  "AXTextField", 
  "AXTextArea",
  "AXCheckBox",
  "AXRadioButton",
  "AXPopUpButton",
  "AXComboBox",
  "AXTab",
  "AXMenuItem",
  "AXSearchField",
  "AXLink"
]

func isClickableRole(_ role: String) -> Bool {
  return clickableRoles.contains(role)
}

func hasClickableAction(_ element: AXUIElement) -> Bool {
  var actionsRef: CFArray?
  guard AXUIElementCopyActionNames(element, &actionsRef) == .success,
        let actions = actionsRef as? [String] else {
    return false
  }
  return actions.contains("AXPress")
}

func getElementRole(_ element: AXUIElement) -> String? {
  var value: CFTypeRef?
  guard AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &value) == .success else {
    return nil
  }
  return value as? String
}

func isElementClickable(_ element: AXUIElement, role: String) -> Bool {
  if isClickableRole(role) {
    return true
  }
  
  // Special case for AXStaticText - check if it has AXPress action
  if role == "AXStaticText" {
    return hasClickableAction(element)
  }
  
  return false
}

func extractElementAttributes(_ element: AXUIElement, essential: Bool = false) -> [String: Any] {
  let attrs = essential ? essentialAttributes : (essentialAttributes + detailedAttributes)
  var dict: [String: Any] = [:]
  
  for attr in attrs {
    var value: CFTypeRef?
    let err = AXUIElementCopyAttributeValue(element, attr as CFString, &value)
    let str = (err == .success && value != nil) ? String(describing: value!) : ""
    dict[attr as String] = str
  }
  
  return dict
}

func elementToDictFlat(
  _ element: AXUIElement, 
  path: [Int], 
  flatList: inout [([Int], [String: Any])],
  maxDepth: Int = 20,
  currentDepth: Int = 0
) {
  // Prevent infinite recursion
  guard currentDepth < maxDepth else { return }
  
  // Quick role check first
  guard let role = getElementRole(element) else { return }
  
  let isGroup = role == "AXGroup"
  let shouldProcessChildren = currentDepth < 15 // Limit depth for better performance
  
  // Only extract detailed attributes for clickable elements
  if isElementClickable(element, role: role) && !isGroup {
    let dict = extractElementAttributes(element, essential: false)
    flatList.append((path, dict))
    
    if verbose {
      print("[elementToDictFlat] Added clickable element at path=\(path) role=\(role)")
    }
  }
  
  // Process children
  if shouldProcessChildren {
    var children: CFTypeRef?
    if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children) == .success,
       let arr = children as? [AXUIElement], !arr.isEmpty {
      
      for (i, child) in arr.enumerated() {
        elementToDictFlat(child, path: path + [i], flatList: &flatList, 
                         maxDepth: maxDepth, currentDepth: currentDepth + 1)
      }
    }
  }
}

func dumpAppUI(bundleId: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.", to: &stderr)
    return
  }
  
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
    print("App not running: \(bundleId)", to: &stderr)
    return
  }
  
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  
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
  let startTime = CFAbsoluteTimeGetCurrent()
  
  for (wIdx, window) in windowList.enumerated() {
    if verbose {
      print("[dumpAppUI] Processing window \(wIdx + 1)/\(windowList.count)")
    }
    elementToDictFlat(window, path: [wIdx], flatList: &flatList)
  }
  
  if verbose {
    let processingTime = CFAbsoluteTimeGetCurrent() - startTime
    print("[dumpAppUI] Element traversal completed in \(String(format: "%.2f", processingTime))s")
    print("[dumpAppUI] Found \(flatList.count) clickable elements")
  }
  
  // Optimized deduplication using Set for O(1) lookups
  var seen = Set<String>()
  var uniqueElements: [([Int], [String: Any])] = []
  
  func createSignature(_ dict: [String: Any]) -> String {
    return essentialAttributes.map {
      (dict[$0 as String] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }.joined(separator: "|")
  }
  
  for (path, dict) in flatList {
    let signature = createSignature(dict)
    if !seen.contains(signature) {
      seen.insert(signature)
      uniqueElements.append((path, dict))
    }
  }
  
  // Create final output
  var idToPath: [Int: [Int]] = [:]
  var flatListWithIds: [[String: Any]] = []
  
  for (idx, (path, dict)) in uniqueElements.enumerated() {
    var dictWithId = dict
    dictWithId["id"] = idx
    flatListWithIds.append(dictWithId)
    idToPath[idx] = path
  }
  
  // Output JSON
  if let data = try? JSONSerialization.data(withJSONObject: flatListWithIds, options: .prettyPrinted) {
    if let jsonString = String(data: data, encoding: .utf8) {
      print(jsonString)
    } else {
      print("Failed to encode JSON to string", to: &stderr)
    }
  } else {
    print("Failed to serialize JSON", to: &stderr)
  }
  
  // Save mapping
  let idToPathStr = Dictionary(
    uniqueKeysWithValues: idToPath.map {
      (String($0.key), $0.value.map(String.init).joined(separator: "."))
    })
  
  if let mapData = try? JSONSerialization.data(withJSONObject: idToPathStr, options: []) {
    try? mapData.write(to: URL(fileURLWithPath: mappingFile))
    
    if verbose {
      let totalTime = CFAbsoluteTimeGetCurrent() - startTime
      print("[dumpAppUI] Completed in \(String(format: "%.2f", totalTime))s")
      print("[dumpAppUI] Wrote mapping for \(uniqueElements.count) elements to \(mappingFile)")
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
  return el
}

func clickElementById(bundleId: String, idStr: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.", to: &stderr)
    return
  }
  
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
    print("App not running: \(bundleId)", to: &stderr)
    return
  }
  
  guard let id = Int(idStr) else {
    print("Invalid id. The ID must be an integer. Do not give a description of the element.", to: &stderr)
    return
  }
  
  guard let mapData = try? Data(contentsOf: URL(fileURLWithPath: mappingFile)),
        let mapObj = try? JSONSerialization.jsonObject(with: mapData) as? [String: String],
        let pathStr = mapObj["\(id)"] else {
    print("Mapping file or id not found", to: &stderr)
    return
  }
  
  let comps = pathStr.split(separator: ".").compactMap { Int($0) }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  
  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement], 
        let wIdx = comps.first, 
        wIdx < windowList.count else {
    print("Invalid window index", to: &stderr)
    return
  }
  
  if let el = elementAtPath(root: windowList[wIdx], path: Array(comps.dropFirst())) {
    if verbose {
      print("[clickElementById] Performing AXPress on element id=\(id) path=\(comps)")
    }
    AXUIElementPerformAction(el, kAXPressAction as CFString)
    print("Clicked element id \(id)")
  } else {
    print("Element not found for id \(id). Make sure you use an element from the list given", to: &stderr)
  }
}

// Main execution
let bundleId = filteredArgs.count > 1 ? filteredArgs[1] : nil
let idStr = filteredArgs.count > 2 ? filteredArgs[2] : nil

if verbose {
  print("[main] Arguments: \(CommandLine.arguments)")
  print("[main] Filtered arguments: \(filteredArgs)")
}

if let b = bundleId, idStr == nil {
  dumpAppUI(bundleId: b)
} else if let b = bundleId, let i = idStr {
  clickElementById(bundleId: b, idStr: i)
} else {
  print("Usage: swift swift/click.swift <bundleId> <elementId?> [--verbose]", to: &stderr)
}