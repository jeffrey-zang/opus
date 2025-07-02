import ApplicationServices
import Cocoa

let app = AXUIElementCreateApplication(
  NSRunningApplication.runningApplications(withBundleIdentifier: "com.hnc.Discord").first!
    .processIdentifier
)

var windowList: CFTypeRef?
AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowList)
let window = (windowList as! [AXUIElement])[0]

func clickKonfer(in element: AXUIElement) -> Bool {
  var value: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value)
  if (value as? String)?.contains("Konfer") == true {
    AXUIElementPerformAction(element, kAXPressAction as CFString)
    return true
  }

  var children: CFTypeRef?
  AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &children)
  for child in (children as? [AXUIElement]) ?? [] {
    if clickKonfer(in: child) { return true }
  }

  return false
}

clickKonfer(in: window)
print("clicked")
