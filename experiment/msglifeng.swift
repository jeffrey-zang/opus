import ApplicationServices
import Cocoa

func quickFillDiscord() {
  // Check permissions
  let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
  guard AXIsProcessTrustedWithOptions(options as CFDictionary) else {
    print("Need accessibility permissions")
    return
  }

  // Find Discord
  let runningApps = NSWorkspace.shared.runningApplications
  guard
    let discordApp = runningApps.first(where: {
      $0.bundleIdentifier == "com.hnc.Discord" || $0.localizedName == "Discord"
    })
  else {
    print("Discord not found")
    return
  }

  let discordElement = AXUIElementCreateApplication(discordApp.processIdentifier)

  // Get windows
  var windowsRef: CFArray?
  guard
    AXUIElementCopyAttributeValues(
      discordElement, kAXWindowsAttribute as CFString, 0, 100, &windowsRef) == .success,
    let windows = windowsRef as? [AXUIElement],
    !windows.isEmpty
  else {
    print("No Discord windows found")
    return
  }

  // Find the specific text area
  if let targetTextArea = findTargetTextArea(in: windows[0]) {
    print("Found target text area!")

    // Method 1: Focus first, then simulate typing
    let focusResult = AXUIElementSetAttributeValue(
      targetTextArea,
      kAXFocusedAttribute as CFString,
      kCFBooleanTrue
    )

    if focusResult == .success {
      print("✅ Focused on text area")

      // Small delay to ensure focus
      usleep(100000)  // 0.1 seconds

      // Clear any existing text first
      let clearResult = AXUIElementSetAttributeValue(
        targetTextArea,
        kAXValueAttribute as CFString,
        "" as CFString
      )

      // Now simulate typing each character
      let message = "Hello Li Feng Yin! 👋"
      simulateTyping(message)

    } else {
      print("❌ Failed to focus: \(focusResult)")
    }
  } else {
    print("Could not find the target text area")
  }
}

func findTargetTextArea(in element: AXUIElement) -> AXUIElement? {
  // Check if this is our target text area
  if isTargetTextArea(element) {
    return element
  }

  // Search children
  var childrenRef: CFTypeRef?
  guard
    AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenRef)
      == .success,
    let children = childrenRef as? [AXUIElement]
  else {
    return nil
  }

  for child in children {
    if let found = findTargetTextArea(in: child) {
      return found
    }
  }

  return nil
}

func isTargetTextArea(_ element: AXUIElement) -> Bool {
  // Check role
  var roleRef: CFTypeRef?
  guard AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef) == .success,
    let role = roleRef as? String,
    role == kAXTextAreaRole as String
  else {
    return false
  }

  // Check description contains "Message @Li Feng Yin"
  var descRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef)
    == .success,
    let desc = descRef as? String,
    desc.contains("Message @Li Feng Yin")
  {
    return true
  }

  return false
}

func simulateTyping(_ text: String) {
  // Method 1: Use CGEvent to simulate actual keystrokes
  for char in text {
    if let keyCode = getKeyCode(for: char) {
      // Key down
      let keyDownEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)
      keyDownEvent?.post(tap: .cghidEventTap)

      // Key up
      let keyUpEvent = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)
      keyUpEvent?.post(tap: .cghidEventTap)

      // Small delay between keystrokes
      usleep(10000)  // 0.01 seconds
    } else {
      // For special characters, use Unicode input
      let keyDownEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
      keyDownEvent?.keyboardSetUnicodeString(
        stringLength: 1, unicodeString: [UniChar(char.unicodeScalars.first!.value)])
      keyDownEvent?.post(tap: .cghidEventTap)

      let keyUpEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)
      keyUpEvent?.post(tap: .cghidEventTap)

      usleep(10000)
    }
  }
}

func getKeyCode(for character: Character) -> CGKeyCode? {
  let char = character.lowercased().first!

  switch char {
  case "a": return 0x00
  case "b": return 0x0B
  case "c": return 0x08
  case "d": return 0x02
  case "e": return 0x0E
  case "f": return 0x03
  case "g": return 0x05
  case "h": return 0x04
  case "i": return 0x22
  case "j": return 0x26
  case "k": return 0x28
  case "l": return 0x25
  case "m": return 0x2E
  case "n": return 0x2D
  case "o": return 0x1F
  case "p": return 0x23
  case "q": return 0x0C
  case "r": return 0x0F
  case "s": return 0x01
  case "t": return 0x11
  case "u": return 0x20
  case "v": return 0x09
  case "w": return 0x0D
  case "x": return 0x07
  case "y": return 0x10
  case "z": return 0x06
  case " ": return 0x31  // Space
  case "!": return 0x12  // 1 with shift
  default: return nil
  }
}

// Run it
quickFillDiscord()
