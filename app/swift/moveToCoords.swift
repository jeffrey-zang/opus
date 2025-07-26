#!/usr/bin/swift

// script that takes a pid, the name of a window, an x, and a y coordinate to move that window to
import AppKit

enum MyError: Error {
  case runtimeError(String)
}

guard let pid = Int32(CommandLine.arguments[1])
else {
  throw MyError.runtimeError("app not running")
}
let appElement = AXUIElementCreateApplication(pid)

var windows: CFTypeRef?
AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windows)
let windowList = windows as? [AXUIElement]

// let windowName = CommandLine.arguments[2]
// guard
//   var targetWindow: AXUIElement = windowList?.first(where: { window in
//     var titleValue: AnyObject?
//     let titleResult = AXUIElementCopyAttributeValue(
//       window, kAXTitleAttribute as CFString, &titleValue)
//     return titleResult == .success && (titleValue as? String) == windowName
//   })
// else {
//   throw MyError.runtimeError("window not found")
// }

guard
  var targetWindow: AXUIElement = windowList?.first
else {
  throw MyError.runtimeError("window not found")
}

guard let x = Int(CommandLine.arguments[3]),
  let y = Int(CommandLine.arguments[4])
else {
  throw MyError.runtimeError("x/y positions are not ints")
}
var point = CGPoint(x: x, y: y)
let position: CFTypeRef = AXValueCreate(AXValueType(rawValue: kAXValueCGPointType)!, &point)!
AXUIElementSetAttributeValue(targetWindow, kAXPositionAttribute as CFString, position)
