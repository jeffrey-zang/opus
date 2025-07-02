// flicks discord to the front briefly to type soemthing and then go back (bad solution)

import ApplicationServices
import Cocoa

func quickDiscordType() {
  // Check permissions
  let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true]
  guard AXIsProcessTrustedWithOptions(options as CFDictionary) else {
    print("Need accessibility permissions")
    return
  }

  // Remember the currently active app
  let currentApp = NSWorkspace.shared.frontmostApplication
  print(currentApp)

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

  print("🚀 Bringing Discord to front...")

  // Bring Discord to the front
  discordApp.activate(options: [.activateIgnoringOtherApps])

  // Wait a moment for Discord to come to front
  usleep(200000)  // 0.2 seconds

  // Click on the message input area (assuming it's usually at the bottom)
  // This is a rough estimate - you might need to adjust coordinates
  clickOnMessageInput()

  // Small delay to ensure input is focused
  usleep(100000)  // 0.1 seconds

  // Type the message naturally
  typeNaturally("Hello Li Feng Yin! This was sent automatically 🤖")

  // Optional: Press Enter to send (remove if you don't want auto-send)
  // pressEnter()

  print("✅ Message typed successfully!")

  // Return to the previous app
  if let previousApp = currentApp {
    usleep(100000)  // Brief pause
    previousApp.activate(options: [.activateIgnoringOtherApps])
    print("🔄 Returned to previous app")
  }
}

func clickOnMessageInput() {
  // Get screen size to estimate message input location
  let screenFrame = NSScreen.main?.frame ?? NSRect.zero

  // Discord message input is typically at the bottom center of the window
  // Adjust these coordinates based on your Discord window size/position
  let clickX = screenFrame.width * 0.5  // Middle of screen
  let clickY = screenFrame.height * 0.15  // Near bottom (15% from bottom)

  let clickPoint = CGPoint(x: clickX, y: clickY)

  // Click at the estimated location
  let clickDown = CGEvent(
    mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: clickPoint,
    mouseButton: .left)
  let clickUp = CGEvent(
    mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: clickPoint,
    mouseButton: .left)

  clickDown?.post(tap: .cghidEventTap)
  clickUp?.post(tap: .cghidEventTap)
}

func typeNaturally(_ text: String) {
  for char in text {
    typeCharacter(char)
    // Random delay between 20-80ms to simulate natural typing
    let delay = UInt32.random(in: 20000...80000)
    usleep(delay)
  }
}

func typeCharacter(_ char: Character) {
  // Convert character to string for easier handling
  let charString = String(char)

  // Use CGEvent to type the character
  let keyDownEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true)
  let keyUpEvent = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false)

  // Set the Unicode string for the character
  let unicodeScalar = char.unicodeScalars.first!.value
  keyDownEvent?.keyboardSetUnicodeString(stringLength: 1, unicodeString: [UniChar(unicodeScalar)])
  keyUpEvent?.keyboardSetUnicodeString(stringLength: 1, unicodeString: [UniChar(unicodeScalar)])

  keyDownEvent?.post(tap: .cghidEventTap)
  keyUpEvent?.post(tap: .cghidEventTap)
}

func pressEnter() {
  let enterDown = CGEvent(keyboardEventSource: nil, virtualKey: 0x24, keyDown: true)  // Return key
  let enterUp = CGEvent(keyboardEventSource: nil, virtualKey: 0x24, keyDown: false)

  enterDown?.post(tap: .cghidEventTap)
  enterUp?.post(tap: .cghidEventTap)
}

// Alternative version that finds the message input more precisely
func findAndClickMessageInput() {
  // This uses the accessibility approach but just to find and click
  let runningApps = NSWorkspace.shared.runningApplications
  guard
    let discordApp = runningApps.first(where: {
      $0.bundleIdentifier == "com.hnc.Discord" || $0.localizedName == "Discord"
    })
  else { return }

  let discordElement = AXUIElementCreateApplication(discordApp.processIdentifier)

  var windowsRef: CFArray?
  guard
    AXUIElementCopyAttributeValues(
      discordElement, kAXWindowsAttribute as CFString, 0, 100, &windowsRef) == .success,
    let windows = windowsRef as? [AXUIElement],
    !windows.isEmpty
  else { return }

  if let textArea = findTargetTextArea(in: windows[0]) {
    // Get the position of the text area
    var positionRef: CFTypeRef?
    if AXUIElementCopyAttributeValue(textArea, kAXPositionAttribute as CFString, &positionRef)
      == .success,
      let position = positionRef as? NSValue
    {
      let point = position.pointValue

      // Click on the text area
      let clickDown = CGEvent(
        mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point,
        mouseButton: .left)
      let clickUp = CGEvent(
        mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point,
        mouseButton: .left)

      clickDown?.post(tap: .cghidEventTap)
      clickUp?.post(tap: .cghidEventTap)
    }
  }
}

func findTargetTextArea(in element: AXUIElement) -> AXUIElement? {
  if isTargetTextArea(element) {
    return element
  }

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
  var roleRef: CFTypeRef?
  guard AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef) == .success,
    let role = roleRef as? String,
    role == kAXTextAreaRole as String
  else {
    return false
  }

  var descRef: CFTypeRef?
  if AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descRef)
    == .success,
    let desc = descRef as? String,
    desc.contains("Message")
  {
    return true
  }

  return false
}

// Run it
quickDiscordType()
