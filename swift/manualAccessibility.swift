#!/usr/bin/swift
import AppKit

enum MyError: Error {
  case runtimeError(String)
}

let bundleId = CommandLine.arguments[1]
guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
else {
  throw MyError.runtimeError("App not running: \(bundleId)")
}
let appElement = AXUIElementCreateApplication(app.processIdentifier)

let result = AXUIElementSetAttributeValue(
  appElement, "AXManualAccessibility" as CFString, kCFBooleanTrue)
print("Setting 'AXManualAccessibility' \(result == .success ? "succeeded" : "failed")")
