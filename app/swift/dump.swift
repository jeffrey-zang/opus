import Foundation
import ApplicationServices
import Cocoa


struct StopWatch {
  private let start: CFAbsoluteTime = CFAbsoluteTimeGetCurrent()
  func elapsed() -> TimeInterval {
    return CFAbsoluteTimeGetCurrent() - start
  }
}

func fetchAttributeNames(of element: AXUIElement) -> [String]? {
  var cfNames: CFTypeRef?
  let err = AXUIElementCopyAttributeNames(element, &cfNames)
  guard err == .success, let names = cfNames as? [String] else { return nil }
  return names
}

func fetchAttributeValue(of element: AXUIElement, name: String) -> Any? {
  var value: CFTypeRef?
  let err = AXUIElementCopyAttributeValue(element, name as CFString, &value)
  guard err == .success else { return nil }
  return value
}


func printSummaryTree(_ element: AXUIElement, indent: String = "") {
  var roleCF: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleCF)
  let role = (roleCF as? String) ?? "UnknownRole"
  print("\(indent)\(role)")

  var childrenCF: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenCF) == .success,
     let children = childrenCF as? [AXUIElement] {
    for child in children {
      printSummaryTree(child, indent: indent + "  ")
    }
  }
}

func printVerboseTree(_ element: AXUIElement, indent: String = "") {

  let fetchRoleSW = StopWatch()
  var roleCF: CFTypeRef?
  let _ = AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleCF)
  let role = (roleCF as? String) ?? "UnknownRole"
  print("\(indent)→ [Role:\(role)] fetched in \(String(format: "%.3fms", fetchRoleSW.elapsed()*1000))")
  

  let fetchNamesSW = StopWatch()
  let names = fetchAttributeNames(of: element) ?? []
  print("\(indent)  • found \(names.count) attribute(s) in \(String(format: "%.3fms", fetchNamesSW.elapsed()*1000))")
  

  for name in names {
    let sw = StopWatch()
    let val = fetchAttributeValue(of: element, name: name)
    let elapsedMs = String(format: "%.3fms", sw.elapsed()*1000)
    let valDesc: String
    switch val {
    case let s as String:       valDesc = "\"\(s)\""
    case let num as NSNumber:   valDesc = num.stringValue
    case let arr as [Any]:      valDesc = "[array count=\(arr.count)]"
    case let elem as AXUIElement: 
      valDesc = "AXElement(pid=\(elem.processIdentifier))"
    case .none:
      valDesc = "nil"
    default:
      valDesc = "\(type(of: val))"
    }
    print("\(indent)    • \(name) = \(valDesc) (\(elapsedMs))")
  }
  

  if names.contains(kAXChildrenAttribute as String),
     let children = fetchAttributeValue(of: element, name: kAXChildrenAttribute as String) as? [AXUIElement],
     !children.isEmpty {
    print("\(indent)  └─ \(children.count) child(ren):")
    for child in children {
      printVerboseTree(child, indent: indent + "    ")
    }
  }
}


let args = CommandLine.arguments
guard args.count >= 2 else {
  print("Usage: swift dump.swift <bundleId> [--verbose]")
  exit(1)
}

let bundleId = args[1]
let verbose = args.contains("--verbose")

guard AXIsProcessTrusted() else {
  print("ERROR: This tool must be added in System Preferences → Security & Privacy → Accessibility.")
  exit(1)
}

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
  print("ERROR: No running application with bundle ID '\(bundleId)'")
  exit(1)
}

let totalSW = StopWatch()

let appElement = AXUIElementCreateApplication(app.processIdentifier)
if verbose {
  print("=== VERBOSE DUMP for \(bundleId) (pid=\(app.processIdentifier)) ===")
} else {
  print("=== SUMMARY DUMP for \(bundleId) (pid=\(app.processIdentifier)) ===")
}

var windowsCF: CFTypeRef?
let err = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsCF)
guard err == .success, let windows = windowsCF as? [AXUIElement], !windows.isEmpty else {
  print("No windows found.")
  let tot = totalSW.elapsed()
  print(String(format: "Total time: %.3fs", tot))
  exit(0)
}

for (i, w) in windows.enumerated() {
  if verbose {
    print("\n--- Window \(i+1) ---")
    printVerboseTree(w, indent: "")
  } else {
    print("\n--- Window \(i+1) ---")
    printSummaryTree(w, indent: "")
  }
}

let totalElapsed = totalSW.elapsed()
print(String(format: "\n>>> TOTAL ELAPSED: %.3fs", totalElapsed))