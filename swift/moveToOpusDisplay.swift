#!/usr/bin/swift

// script that takes a bundleId and the name of a window and moves it to Opus' display.
// Returns the original window coordinates for moving back
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

var originalCoords: AnyObject?
AXUIElementCopyAttributeValue(targetWindow, kAXPositionAttribute as CFString, &originalCoords)
var output = CGPoint.zero
AXValueGetValue(originalCoords as! AXValue, AXValueType.cgPoint, &output)
print("\(Int(output.x)) \(Int(output.y))")

let screens = NSScreen.screens
for screen in screens {
  if screen.localizedName == "Opus Display" {
    var point = screen.visibleFrame.origin
    let position: CFTypeRef = AXValueCreate(AXValueType(rawValue: kAXValueCGPointType)!, &point)!
    AXUIElementSetAttributeValue(targetWindow, kAXPositionAttribute as CFString, position)
  }
}
