import ApplicationServices
import Cocoa

// Enable accessibility permissions first
func requestAccessibilityPermissions() -> Bool {
  let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
  return AXIsProcessTrustedWithOptions(options as CFDictionary)
}

func fillDiscordMessage() {
  guard requestAccessibilityPermissions() else {
    print("Need accessibility permissions")
    return
  }

  // Get Discord app
  let runningApps = NSWorkspace.shared.runningApplications
  guard
    let discordApp = runningApps.first(where: {
      $0.bundleIdentifier == "com.hnc.Discord" || $0.localizedName == "Discord"
    })
  else {
    print("Discord not found")
    return
  }

  // Get accessibility element for Discord
  let discordElement = AXUIElementCreateApplication(discordApp.processIdentifier)

  // Get windows
  var windowsRef: CFArray?
  let result = AXUIElementCopyAttributeValues(
    discordElement,
    kAXWindowsAttribute as CFString,
    0,
    100,
    &windowsRef
  )

  guard result == .success,
    let windowsArray = windowsRef,
    let windows = windowsArray as? [AXUIElement],
    !windows.isEmpty
  else {
    print("No Discord windows found")
    return
  }

  // Find text input field in the main window
  let mainWindow = windows[0]
  print("🔍 Starting search in Discord main window...")
  print("=" * 50)

  // Search for text field recursively
  if let textField = findTextFieldRecursively(element: mainWindow, depth: 0) {
    print("\n✅ Found target text field!")
    print("=" * 50)

    // Set the text
    let result = AXUIElementSetAttributeValue(
      textField,
      kAXValueAttribute as CFString,
      "Hello from background automation!" as CFString
    )

    if result == .success {
      print("Message filled successfully!")
    } else {
      print("Failed to set text: \(result)")
    }
  } else {
    print("\n❌ Could not find text input field")
  }
}

func findTextFieldRecursively(element: AXUIElement, depth: Int) -> AXUIElement? {
  let indent = String(repeating: "  ", count: depth)

  // Get element information for debugging
  let elementInfo = getElementInfo(element: element)
  print("\(indent)📋 \(elementInfo)")

  // Check if this element is a text field
  var roleRef: CFTypeRef?
  let roleResult = AXUIElementCopyAttributeValue(
    element,
    kAXRoleAttribute as CFString,
    &roleRef
  )

  // if roleResult == .success, let role = roleRef as? String {
  //   if role == kAXTextFieldRole as String || role == kAXTextAreaRole as String {
  //     print("\(indent)🎯 Found text field/area!")

  //     // Check if it's editable
  //     var editableRef: CFTypeRef?
  //     let editableResult = AXUIElementCopyAttributeValue(
  //       element,
  //       kAXEnabledAttribute as CFString,
  //       &editableRef
  //     )

  //     if editableResult == .success,
  //       let editable = editableRef as? Bool,
  //       editable
  //     {
  //       print("\(indent)✅ Text field is editable - this is our target!")
  //       return element
  //     } else {
  //       print("\(indent)❌ Text field is not editable")
  //     }
  //   }
  // }

  // Recursively search children
  var childrenRef: CFTypeRef?
  let childrenResult = AXUIElementCopyAttributeValue(
    element,
    kAXChildrenAttribute as CFString,
    &childrenRef
  )

  if childrenResult == .success, let children = childrenRef as? [AXUIElement] {
    if !children.isEmpty {
      print("\(indent)📁 Searching \(children.count) children...")
    }

    for (index, child) in children.enumerated() {
      print("\(indent)├─ Child \(index + 1)/\(children.count):")
      if let found = findTextFieldRecursively(element: child, depth: depth + 1) {
        return found
      }
    }
  }

  return nil
}

func getElementInfo(element: AXUIElement) -> String {
  var info: [String] = []

  // Get role
  var roleRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef) == .success,
    let role = roleRef as? String
  {
    info.append("Role: \(role)")
  }

  // Get title/label
  var titleRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleRef) == .success,
    let title = titleRef as? String, !title.isEmpty
  {
    info.append("Title: '\(title)'")
  }

  // Get description
  var descRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef)
    == .success,
    let desc = descRef as? String, !desc.isEmpty
  {
    info.append("Desc: '\(desc)'")
  }

  // Get value (for text fields)
  var valueRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueRef) == .success,
    let value = valueRef as? String, !value.isEmpty
  {
    let truncatedValue = value.count > 30 ? String(value.prefix(30)) + "..." : value
    info.append("Value: '\(truncatedValue)'")
  }

  // Get placeholder value
  var placeholderRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(
    element, kAXPlaceholderValueAttribute as CFString, &placeholderRef) == .success,
    let placeholder = placeholderRef as? String, !placeholder.isEmpty
  {
    info.append("Placeholder: '\(placeholder)'")
  }

  // Get enabled status
  var enabledRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabledRef)
    == .success,
    let enabled = enabledRef as? Bool
  {
    info.append("Enabled: \(enabled)")
  }

  return info.isEmpty ? "Unknown element" : info.joined(separator: " | ")
}

// String repeat operator for visual separation
extension String {
  static func * (left: String, right: Int) -> String {
    return String(repeating: left, count: right)
  }
}

// Run the function
fillDiscordMessage()
