#!/usr/bin/swift

// This script is used to test /swift/key.swift by testing every clickable key
// Usage: swift test_key.swift <AppBundleIdentifier>
// I recommend going to https://www.keyboardtester.com/tester.html

import Foundation

if CommandLine.arguments.count < 2 {
  print("Usage: swift test_key.swift <AppBundleIdentifier>")
  exit(1)
}
let bundleId = CommandLine.arguments[1]
let allChars: [Character] = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-=[]\\;',./`~!@#$%^&*()_+|:\"<>? ")
let specialKeys = [
  "enter", "return", "tab", "esc", "space", "delete", "up", "dn", "lt", "rt", "fn", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"
]
let modifierKeys = [
  "command",
  "shift",
  "option",
  "control"
]
let keyScript = "swift/key.swift"

func runKeyScript(args: [String]) {
  let process = Process()
  process.launchPath = "/usr/bin/swift"
  process.arguments = [keyScript] + args
  let pipe = Pipe()
  process.standardOutput = pipe
  process.standardError = pipe
  process.launch()
  process.waitUntilExit()
  let data = pipe.fileHandleForReading.readDataToEndOfFile()
  if let output = String(data: data, encoding: .utf8) {
    print(output)
  }
}

// for c in allChars {
//   runKeyScript(args: [bundleId, String(c)])
// }
for key in [specialKeys, modifierKeys] {
  runKeyScript(args: [bundleId, "^" + key])
}