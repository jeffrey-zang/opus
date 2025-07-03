#!/usr/bin/swift
import ApplicationServices
import Cocoa
import CoreFoundation

struct DebugDebouncer {
  static var hasPrintedAttributes = false
}

// Helper function to safely get string attribute
func getStringAttribute(from element: AXUIElement, attribute: String) -> String? {
  var value: CFTypeRef?
  let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)

  if result == .success {
    return value as? String
  }
  return nil
}

// Helper function to safely get array attribute
func getArrayAttribute(from element: AXUIElement, attribute: String) -> [AXUIElement]? {
  var value: CFTypeRef?
  let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)

  if result == .success {
    return value as? [AXUIElement]
  }
  return nil
}

// Helper function to get position
func getPosition(from element: AXUIElement) -> CGPoint? {
  var value: CFTypeRef?
  let result = AXUIElementCopyAttributeValue(element, "AXPosition" as CFString, &value)

  if result == .success, let axValue = value {
    var point = CGPoint.zero
    if AXValueGetValue(axValue as! AXValue, .cgPoint, &point) {
      return point
    }
  }
  return nil
}

// Helper function to get size
func getSize(from element: AXUIElement) -> CGSize? {
  var value: CFTypeRef?
  let result = AXUIElementCopyAttributeValue(element, "AXSize" as CFString, &value)

  if result == .success, let axValue = value {
    var size = CGSize.zero
    if AXValueGetValue(axValue as! AXValue, .cgSize, &size) {
      return size
    }
  }
  return nil
}

func isClickableRole(_ role: String) -> Bool {
  let clickableRoles = [
    "AXButton",
    "AXLink",
    "AXTextField",
    "AXTextArea",
    "AXCheckBox",
    "AXRadioButton",
    "AXPopUpButton",
    "AXComboBox",
    "AXTab",
    "AXMenuItem",
    "AXImage",
    "AXCell",
    "AXSearchField",
    "AXStaticText",  // Sometimes clickable in web pages
  ]

  return clickableRoles.contains(role)
}

struct ClickableElement: Codable {
  var id: Int?
  let role: String
  let title: String
  let description: String
}

// Overload for the script's internal use
struct ClickableElementInternal {
  let element: AXUIElement
  let role: String
  let title: String
  let position: CGPoint?
  let size: CGSize?
}

func scanElement(_ element: AXUIElement, depth: Int = 0) -> [ClickableElementInternal] {
  guard depth < 25 else { return [] }  // Prevent infinite recursion

  var results: [ClickableElementInternal] = []

  // Get role
  guard let role = getStringAttribute(from: element, attribute: "AXRole") else {
    return results
  }

  // Check if clickable
  if isClickableRole(role) {
    var title = getStringAttribute(from: element, attribute: "AXTitle") ?? ""
    if title.isEmpty {
      title =
        getStringAttribute(from: element, attribute: "AXDescription")
        ?? getStringAttribute(from: element, attribute: "AXValue")
        ?? getStringAttribute(from: element, attribute: "AXHelp") ?? ""
    }

    // Only include elements with useful info or good positions
    let position = getPosition(from: element)
    let size = getSize(from: element)

    // Filter out tiny or obviously non-interactive elements
    var shouldInclude = true
    if let sz = size, sz.width < 5 || sz.height < 5 {
      shouldInclude = false
    }

    if shouldInclude {
      results.append(
        ClickableElementInternal(
          element: element,
          role: role,
          title: title.isEmpty ? "(no text)" : title,
          position: position,
          size: size
        ))
    }
  }

  // Scan children
  if let children = getArrayAttribute(from: element, attribute: "AXChildren") {
    for child in children {
      results.append(contentsOf: scanElement(child, depth: depth + 1))
    }
  }

  return results
}

let showOutput =
  CommandLine.arguments.count < 2
  || (CommandLine.arguments[1] != "json-list" && CommandLine.arguments[1] != "click")

if showOutput {
  print("Accessibility Scanner")
  print("============================")
}

// Check if accessibility is enabled
let trusted = AXIsProcessTrusted()
if showOutput {
  print("Accessibility trusted: \(trusted)")
}

if !trusted {
  // Always print this error
  print("❌ Accessibility not enabled.")
  print("Go to: System Preferences > Security & Privacy > Privacy > Accessibility")
  print("Add your terminal or application and make sure it's checked.")
  exit(1)
}

// Get frontmost application
guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
  print("❌ Could not determine the frontmost application.")
  exit(1)
}
let appElement = AXUIElementCreateApplication(frontmostApp.processIdentifier)

if showOutput {
  if let appName = frontmostApp.localizedName {
    print("✅ Scanning active application: \(appName)")
  } else {
    print("✅ Scanning active application.")
  }
}

// Get application windows
guard let windows = getArrayAttribute(from: appElement, attribute: "AXWindows") else {
  print("❌ Could not get application windows")
  exit(1)
}
if showOutput {
  print("🔍 Scanning \(windows.count) window(s)...")
}

var allElements: [ClickableElementInternal] = []

for (index, window) in windows.enumerated() {
  if showOutput {
    print("Scanning window \(index + 1)...")
  }
  let elements = scanElement(window)
  allElements.append(contentsOf: elements)
  if showOutput {
    print("  Found \(elements.count) clickable elements")
  }
}

// Remove duplicates based on position and title
var uniqueElements: [ClickableElementInternal] = []
for element in allElements {
  let isDuplicate = uniqueElements.contains { existing in
    existing.title == element.title && existing.position?.x == element.position?.x
      && existing.position?.y == element.position?.y
  }

  if !isDuplicate {
    uniqueElements.append(element)
  }
}

// --- Command Handling ---

// 1. Click Command
if CommandLine.arguments.count > 2, CommandLine.arguments[1] == "click",
  let numberToClick = Int(CommandLine.arguments[2])
{
  guard numberToClick > 0, numberToClick <= uniqueElements.count else {
    print(
      "{\"error\": \"Invalid number. Please provide a number between 1 and \(uniqueElements.count).\"}"
    )
    exit(1)
  }

  let elementToClick = uniqueElements[numberToClick - 1]
  let action = kAXPressAction as CFString
  let result = AXUIElementPerformAction(elementToClick.element, action)

  if result == .success {
    print(
      "{\"success\": true, \"clicked_element\": {\"id\": \(numberToClick), \"title\": \"\(elementToClick.title)\"}}"
    )
  } else {
    var errorString = "Failed to click element #\(numberToClick). Error: \(result.rawValue)"
    if result.rawValue == -25200 {  // kAXErrorAPIDisabled
      errorString +=
        ". This typically means the app/terminal running this script does not have Accessibility permissions. Please grant access in System Settings > Privacy & Security > Accessibility."
    }
    print("{\"success\": false, \"error\": \"\(errorString)\"}")
  }
  exit(0)
}

// 2. JSON List Command
if CommandLine.arguments.count > 1, CommandLine.arguments[1] == "json-list" {
  var elementsToEncode: [ClickableElement] = []
  for (index, element) in uniqueElements.enumerated() {
    let description = "\(element.role): \(element.title)"
    elementsToEncode.append(
      ClickableElement(
        id: index + 1,
        role: element.role,
        title: element.title,
        description: description
      )
    )
  }
  let encoder = JSONEncoder()
  encoder.outputFormatting = .prettyPrinted
  do {
    let jsonData = try encoder.encode(elementsToEncode)
    if let jsonString = String(data: jsonData, encoding: .utf8) {
      print(jsonString)
    }
  } catch {
    print("{\"error\": \"Failed to encode elements to JSON.\"}")
  }
  exit(0)
}

// 3. Default: Human-readable output
if showOutput {
  print("\n📋 Clickable elements in current application (Voice Control style):")
  print(String(repeating: "=", count: 80))

  for (index, element) in uniqueElements.enumerated() {
    let number = String(format: "%3d", index + 1)
    let role = element.role.replacingOccurrences(of: "AX", with: "")
    let title = String(element.title.prefix(35))

    var posStr = "        "
    if let pos = element.position {
      posStr = String(format: "(%3.0f,%3.0f)", pos.x, pos.y)
    }

    var sizeStr = ""
    if let size = element.size {
      sizeStr = String(format: " [%dx%d]", Int(size.width), Int(size.height))
    }

    print(
      "\(number): [\(role.padding(toLength: 12, withPad: " ", startingAt: 0))] \(posStr)\(sizeStr) \(title)"
    )
  }

  print("\n🎯 Total: \(uniqueElements.count) unique clickable elements!")
  print("This matches what Voice Control shows when you say 'Show Numbers'")

  if uniqueElements.count > 100 {
    print("💡 Tip: This is a lot of elements! Voice Control usually filters these better.")
  }
}
