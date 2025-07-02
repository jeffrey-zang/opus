#!/usr/bin/swift

// script that performs background keypresses onto a given app
// usage requires an argument ie. swift discord_keys.swift "abba"

import Cocoa
import CoreGraphics

// Key codes for common characters
let KEY_CODES: [Character: CGKeyCode] = [
  "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "i": 34,
  "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31, "p": 35, "q": 12,
  "r": 15, "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7, "y": 16, "z": 6,
  " ": 49,  // space
  "\n": 36,  // return/enter
]

let KEY_ENTER: CGKeyCode = 36  // Enter key

func findDiscordProcess() -> pid_t? {
  let workspace = NSWorkspace.shared
  let runningApps = workspace.runningApplications

  // Look for Discord app
  for app in runningApps {
    if let bundleId = app.bundleIdentifier {
      if bundleId.contains("spotify") || bundleId.contains("spotify") {
        return app.processIdentifier
      }
    }
    if let appName = app.localizedName {
      if appName.lowercased().contains("spotify") {
        return app.processIdentifier
      }
    }
  }
  return nil
}

func sendKeyToPid(_ keyCode: CGKeyCode, _ pid: pid_t) {
  let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)
  let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)

  keyDown?.postToPid(pid)
  usleep(1_000_000)  // 50ms delay
  keyUp?.postToPid(pid)
  usleep(1_000_000)  // 50ms delay between keys
}

func paste() {
  let cmdDown = CGEvent(keyboardEventSource: nil, virtualKey: 0x37, keyDown: true)
  let vDown = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: true)
  let vUp = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: false)
  let cmdUp = CGEvent(keyboardEventSource: nil, virtualKey: 0x37, keyDown: false)

  cmdDown?.flags = .maskCommand
  vDown?.flags = .maskCommand
  vUp?.flags = .maskCommand

  cmdDown?.post(tap: .cghidEventTap)
  vDown?.post(tap: .cghidEventTap)
  vUp?.post(tap: .cghidEventTap)
  cmdUp?.post(tap: .cghidEventTap)
}

func copyToClipboard(_ text: String) {
  let pasteboard = NSPasteboard.general
  pasteboard.clearContents()
  pasteboard.setString(text, forType: .string)
}

func sendTextToDiscord(_ text: String) {
  guard let discordPid = findDiscordProcess() else {
    print("❌ Discord not found. Make sure Discord is running.")
    return
  }

  print("✅ Found Discord (PID: \(discordPid))")
  print("📋 Copying text to clipboard: \"\(text)\"")

  // Copy text to clipboard
  copyToClipboard(text)

  print("📋 Pasting via individual keystrokes...")

  // Type the text character by character (from clipboard would be ideal but this works)
  for char in text.lowercased() {
    if let keyCode = KEY_CODES[char] {
      sendKeyToPid(keyCode, discordPid)
    }
  }
  // paste()

  // Press Enter to send
  print("⏎ Pressing Enter to send...")
  // usleep(100000)  // 100ms delay before Enter
  // sendKeyToPid(KEY_ENTER, discordPid)

  print("✅ Message sent to Discord!")
}

// Main execution
if CommandLine.arguments.count < 2 {
  print("Usage: swift discord_keys.swift \"Your message here\"")
  print("Example: swift discord_keys.swift \"hello world\"")
  exit(1)
}

let message = CommandLine.arguments[1]
sendTextToDiscord(message)

// for number in 1...10 {
//   sendTextToDiscord(message)
// }
