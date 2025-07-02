import ApplicationServices
import Cocoa

// MARK: - Setup

let discordBundleId = "com.hnc.Discord"
let targetDMName = "Li Feng Yin"
let messageToSend = "hey from opus 👋"

let app = AXUIElementCreateApplication(
  NSRunningApplication.runningApplications(withBundleIdentifier: discordBundleId).first!
    .processIdentifier
)

var windowList: CFTypeRef?
AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowList)
let window = (windowList as! [AXUIElement])[0]

// MARK: - DM Click

func findAndClickDM(named name: String, in element: AXUIElement) -> Bool {
  var value: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)

  if let stringVal = value as? String, stringVal == name {
    AXUIElementPerformAction(element, kAXPressAction as CFString)
    print("✅ Clicked DM: \(stringVal)")
    return true
  }

  var children: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
  for child in (children as? [AXUIElement]) ?? [] {
    if findAndClickDM(named: name, in: child) { return true }
  }
  return false
}

// MARK: - Input Interaction

func findInput(in element: AXUIElement) -> AXUIElement? {
  var role: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)

  if let roleStr = role as? String, roleStr == kAXTextAreaRole as String {
    return element
  }

  var children: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
  for child in (children as? [AXUIElement]) ?? [] {
    if let result = findInput(in: child) { return result }
  }
  return nil
}

func setText(_ text: String, in element: AXUIElement) -> Bool {
  return AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFTypeRef)
    == .success
}

func simulateEnter() {
  let src = CGEventSource(stateID: .hidSystemState)
  let down = CGEvent(keyboardEventSource: src, virtualKey: 0x24, keyDown: true)  // Enter
  let up = CGEvent(keyboardEventSource: src, virtualKey: 0x24, keyDown: false)
  down?.post(tap: .cghidEventTap)
  up?.post(tap: .cghidEventTap)
}

// MARK: - Run

guard
  AXIsProcessTrustedWithOptions(
    [
      kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
    ] as CFDictionary)
else {
  print("❗️Enable Accessibility permissions.")
  exit(1)
}

if findAndClickDM(named: targetDMName, in: window) {
  usleep(500_000)  // wait for chat to load

  if let input = findInput(in: window) {
    AXUIElementPerformAction(input, kAXPressAction as CFString)  // focus
    usleep(200_000)
    setText(messageToSend, in: input)
    usleep(200_000)
    simulateEnter()
    print("✅ Message sent to \(targetDMName)")
  } else {
    print("❌ Could not find message input")
  }
} else {
  print("❌ DM not found: \(targetDMName)")
}
