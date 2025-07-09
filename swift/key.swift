#!/usr/bin/swift

// This script is used to send keypresses to an app (background or foreground)z
// Usage: Usage: swift key.swift <AppBundleIdentifier> "Your message here"
// For special keys and modifiers, prefix with ^ (caret). Ex. "hello ^enter" or "^cmd+t youtube.com ^enter"
// To type a caret, escape it with a double caret ex. "^^"

import Cocoa
import CoreGraphics
import Foundation

let mappingFile = "/tmp/opus-ax-paths.json"
let KEY_CODES: [Character: CGKeyCode] = [
  "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "i": 34,
  "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31, "p": 35, "q": 12,
  "r": 15, "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7, "y": 16, "z": 6,
  "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25,
  " ": 49, "\n": 36, "\t": 48,
  "-": 27, "=": 24, "[": 33, "]": 30, "\\": 42, ";": 41, "'": 39, ",": 43, ".": 47, "/": 44,
  "`": 50,
]

let SHIFT_SYMBOLS: [Character: Character] = [
  ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/", "_": "-", "+": "=", "|": "\\",
  "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8",
  "(": "9", ")": "0",
]

let MODIFIER_FLAGS: [String: CGEventFlags] = [
  "command": .maskCommand, "cmd": .maskCommand,
  "shift": .maskShift,
  "option": .maskAlternate, "opt": .maskAlternate, "alt": .maskAlternate,
  "control": .maskControl, "ctrl": .maskControl, "ctl": .maskControl,
]

let SPECIAL_KEYS: [String: CGKeyCode] = [
  "enter": 36, "return": 36, "ret": 36,
  "tab": 48,
  "esc": 53, "escape": 53,
  "space": 49, "spc": 49,
  "delete": 51, "backspace": 51, "bsp": 51, "del": 51,
  "up": 126, "up_arrow": 126,
  "dn": 125, "down": 125, "down_arrow": 125,
  "lt": 123, "left": 123, "left_arrow": 123,
  "rt": 124, "right": 124, "right_arrow": 124,
  "fn": 127, "function": 127,
  "f1": 122,
  "f2": 120,
  "f3": 99,
  "f4": 118,
  "f5": 96,
  "f6": 97,
  "f7": 98,
  "f8": 100,
  "f9": 101,
  "f10": 109,
  "f11": 103,
  "f12": 111,
]

func findAppProcess(bundleId: String) -> pid_t? {
  for app in NSWorkspace.shared.runningApplications {
    if app.bundleIdentifier == bundleId {
      return app.processIdentifier
    }
  }
  return nil
}

func sendKeyToPid(_ keyCode: CGKeyCode, _ pid: pid_t, modifiers: [String] = []) {
  var flags: CGEventFlags = []
  for mod in modifiers {
    if let f = MODIFIER_FLAGS[mod.lowercased()] {
      flags.insert(f)
    }
  }
  let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)
  let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)
  keyDown?.flags = flags
  keyUp?.flags = flags
  keyDown?.postToPid(pid)
  keyUp?.postToPid(pid)
  usleep(5000)
}

func sendCharToPid(_ char: Character, _ pid: pid_t) {
  var mods: [String] = []
  var keyChar = char
  if char.isUppercase {
    mods.append("shift")
    keyChar = Character(char.lowercased())
  } else if SHIFT_SYMBOLS.keys.contains(char) {
    mods.append("shift")
    keyChar = SHIFT_SYMBOLS[char]!
  }
  if let keyCode = KEY_CODES[keyChar] {
    sendKeyToPid(keyCode, pid, modifiers: mods)
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

func typeElementById(bundleId: String, idStr: String, string: String) {
  guard AXIsProcessTrusted() else {
    print("Enable Accessibility permissions for this app.")
    return
  }
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
  else {
    print("App not running: \(bundleId)")
    return
  }
  guard let id = Int(idStr) else {
    print("Invalid id")
    return
  }
  guard let mapData = try? Data(contentsOf: URL(fileURLWithPath: mappingFile)),
    let mapObj = try? JSONSerialization.jsonObject(with: mapData) as? [String: String],
    let pathStr = mapObj["\(id)"]
  else {
    print("Mapping file or id not found")
    return
  }
  let comps = pathStr.split(separator: ".").compactMap { Int($0) }
  let appElement = AXUIElementCreateApplication(app.processIdentifier)
  var windows: CFTypeRef?
  AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
  guard let windowList = windows as? [AXUIElement], let wIdx = comps.first, wIdx < windowList.count
  else {
    print("Invalid window index")
    return
  }
  let el = elementAtPath(root: windowList[wIdx], path: Array(comps.dropFirst()))
  if let el = el {
    AXUIElementSetAttributeValue(el, "AXValue" as CFString, string as CFTypeRef)
    print("typed in element id \(id)")
  } else {
    print("Element not found for id \(id)")
  }
}

if CommandLine.arguments.count < 3 {
  print("Usage: swift key.swift <AppBundleIdentifier> \"Your message here\"")
  exit(1)
}

let bundleId = CommandLine.arguments[1]
var message = CommandLine.arguments[2]
if message.first == "\"" && message.last == "\"" && message.count >= 2 {
  message = String(message.dropFirst().dropLast())
}

guard let pid = findAppProcess(bundleId: bundleId) else {
  print("App not found: \(bundleId)")
  exit(1)
}

print("message: \(message)")
let tokens = message.split(separator: " ").map(String.init)
print("tokens: \(tokens)")
for i in 0..<tokens.count {
  let token = tokens[i]

  print("token: \(token)")
  if token.hasPrefix("^^") {
    let rest = String(token.dropFirst())
    for c in rest {
      sendCharToPid(c, pid)
    }
  } else if token.hasPrefix("^") {
    let cmd = String(token.dropFirst())
    print("cmd: \(cmd)")
    let parts = cmd.split(separator: "+").map { String($0) }
    print("parts: \(parts)")
    var mods: [String] = []
    var key: String? = nil
    for part in parts {
      if MODIFIER_FLAGS.keys.contains(part.lowercased()) {
        mods.append(part)
      } else if SPECIAL_KEYS.keys.contains(part.lowercased()) {
        key = part
      } else if part.count == 1 {
        key = part
      }
    }
    if let k = key {
      if let code = SPECIAL_KEYS[k.lowercased()] {
        sendKeyToPid(code, pid, modifiers: mods)
      } else if let char = k.first, let keyCode = KEY_CODES[char] {
        var sendMods = mods
        if k.count == 1, let c = k.first, c.isUppercase || SHIFT_SYMBOLS.keys.contains(c) {
          if !sendMods.contains("shift") { sendMods.append("shift") }
        }
        sendKeyToPid(keyCode, pid, modifiers: sendMods)
      }
    }
  } else {
    for c in token {
      sendCharToPid(c, pid)
    }
    if i < tokens.count - 1 {
      if let spaceKeyCode = KEY_CODES[" "] {
        sendKeyToPid(spaceKeyCode, pid)
      }
    }
    // typeElementById(bundleId: bundleId, idStr: "11", string: token)
  }
}
