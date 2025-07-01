#!/usr/bin/swift

import Cocoa
import CoreGraphics
import Foundation

// Usage: swift discord_keys_simple.swift <AppBundleIdentifier> \"Your message here\"

let KEY_CODES: [Character: CGKeyCode] = [
  "a": 0, "b": 11, "c": 8, "d": 2, "e": 14, "f": 3, "g": 5, "h": 4, "i": 34,
  "j": 38, "k": 40, "l": 37, "m": 46, "n": 45, "o": 31, "p": 35, "q": 12,
  "r": 15, "s": 1, "t": 17, "u": 32, "v": 9, "w": 13, "x": 7, "y": 16, "z": 6,
  "0": 29, "1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25,
  " ": 49, "\n": 36, "\t": 48,
  "-": 27, "=": 24, "[": 33, "]": 30, "\\": 42, ";": 41, "'": 39, ",": 43, ".": 47, "/": 44, "`": 50,
  "~": 50, "!": 18, "@": 19, "#": 20, "$": 21, "%": 23, "^": 22, "&": 26, "*": 28, "(": 25, ")": 29,
  "_": 27, "+": 24, "{": 33, "}": 30, "|": 42, ":": 41, "\"": 39, "<": 43, ">": 47, "?": 44
]

struct KeyAction: Codable {
  let key: String?
  let modifiers: [String]?
  let enter: Bool?
}

let MODIFIER_FLAGS: [String: CGEventFlags] = [
  "command": .maskCommand,
  "shift": .maskShift,
  "option": .maskAlternate,
  "alt": .maskAlternate,
  "control": .maskControl,
  "ctrl": .maskControl,
]

let SPECIAL_KEYS: [String: CGKeyCode] = [
  "enter": 36,
  "return": 36,
  "tab": 48,
  "esc": 53,
  "escape": 53,
  "space": 49,
]

func findAppProcess(bundleId: String) -> pid_t? {
  let workspace = NSWorkspace.shared
  let runningApps = workspace.runningApplications
  for app in runningApps {
    if let id = app.bundleIdentifier, id == bundleId {
      return app.processIdentifier
    }
  }
  return nil
}

func sendKeyToPid(_ keyCode: CGKeyCode, _ pid: pid_t, modifiers: [String] = []) {
  var flags: CGEventFlags = []
  for mod in modifiers { if let f = MODIFIER_FLAGS[mod.lowercased()] { flags.insert(f) } }
  let keyDown = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: true)
  let keyUp = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: false)
  keyDown?.flags = flags
  keyUp?.flags = flags
  keyDown?.postToPid(pid)
  usleep(1000)
  keyUp?.postToPid(pid)
  usleep(1000)
}

func sendEnterToPid(_ pid: pid_t, modifiers: [String] = []) {
  sendKeyToPid(36, pid, modifiers: modifiers)
}

func parseKeyActions(_ input: String) -> [KeyAction]? {
  if let data = input.data(using: .utf8) {
    if let arr = try? JSONDecoder().decode([KeyAction].self, from: data) { return arr }
  }
  return nil
}

func parseKeypressSequence(_ input: String) -> [KeyAction]? {
  let tokens = input.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: " ").map {
    String($0)
  }
  var actions: [KeyAction] = []
  for token in tokens {
    let parts = token.split(separator: "+").map { String($0) }
    if parts.count == 1 {
      let key = parts[0].lowercased()
      if SPECIAL_KEYS[key] != nil {
        actions.append(
          KeyAction(key: key, modifiers: nil, enter: key == "enter" || key == "return"))
      } else if MODIFIER_FLAGS[key] != nil {
        actions.append(KeyAction(key: nil, modifiers: [key], enter: nil))
      } else if KEY_CODES[key.first ?? " "] != nil {
        actions.append(KeyAction(key: key, modifiers: nil, enter: nil))
      }
    } else {
      let key = parts.last!.lowercased()
      let mods = parts.dropLast().map { $0.lowercased() }
      if SPECIAL_KEYS[key] != nil {
        actions.append(
          KeyAction(key: key, modifiers: mods, enter: key == "enter" || key == "return"))
      } else if KEY_CODES[key.first ?? " "] != nil {
        actions.append(KeyAction(key: key, modifiers: mods, enter: nil))
      }
    }
  }
  return actions.isEmpty ? nil : actions
}

func parseNaturalLanguage(_ input: String) -> [KeyAction]? {
  let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.contains("then enter") {
    let parts = trimmed.components(separatedBy: "then enter")
    let chars = parts[0].trimmingCharacters(in: .whitespaces)
    var actions: [KeyAction] = chars.map { KeyAction(key: String($0), modifiers: nil, enter: nil) }
    actions.append(KeyAction(key: nil, modifiers: nil, enter: true))
    return actions
  }
  if trimmed.contains("+") {
    let parts = trimmed.lowercased().split(separator: "+").map {
      $0.trimmingCharacters(in: .whitespaces)
    }
    if let key = parts.last, parts.count > 1 {
      let mods = parts.dropLast().map { $0 }
      return [KeyAction(key: String(key), modifiers: mods, enter: nil)]
    }
  }
  return nil
}

if CommandLine.arguments.count < 3 {
  print("Usage: swift discord_keys_simple.swift <AppBundleIdentifier> \"Your message here\"")
  exit(1)
}

let bundleId = CommandLine.arguments[1]
let message = CommandLine.arguments[2]

guard let pid = findAppProcess(bundleId: bundleId) else {
  print("App not found: \(bundleId)")
  exit(1)
}

if let actions = parseKeyActions(message) ?? parseKeypressSequence(message)
  ?? parseNaturalLanguage(message)
{
  for action in actions {
    if let key = action.key {
      let keyLower = key.lowercased()
      var mods = action.modifiers ?? []
      var sendKey: String = keyLower
      if key.count == 1 {
        let c = key.first!
        if c.isUppercase || "~!@#$%^&*()_+{}|:\\\"<>?".contains(c) {
          if !mods.contains("shift") { mods.append("shift") }
          sendKey = keyLower
        }
      }
      if let code = SPECIAL_KEYS[keyLower] {
        sendKeyToPid(code, pid, modifiers: mods)
      } else if let char = sendKey.first, let keyCode = KEY_CODES[char] {
        sendKeyToPid(keyCode, pid, modifiers: mods)
      }
    }
    if action.enter == true {
      sendEnterToPid(pid, modifiers: action.modifiers ?? [])
    }
  }
} else {
  for char in message {
    var mods: [String] = []
    var keyChar = char
    if char.isUppercase || "~!@#$%^&*()_+{}|:\\\"<>?".contains(char) {
      mods.append("shift")
      keyChar = Character(char.lowercased())
    }
    if let keyCode = KEY_CODES[keyChar] {
      sendKeyToPid(keyCode, pid, modifiers: mods)
    }
  }
}
