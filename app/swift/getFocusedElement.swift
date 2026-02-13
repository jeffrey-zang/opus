import ApplicationServices
import AppKit

// This script provides the currently focused element. 
// Usage: swift getFocusedElement.swift

let allAccessibilityAttributes = [
  "AXRole",
  "AXTitle", 
  "AXHelp",
  "AXValue",
  "AXDescription",
  "AXSubrole",
  "AXRoleDescription",
  "AXPlaceholderValue"
]

if let frontApp = NSWorkspace.shared.frontmostApplication {
    print("Front app: \(frontApp.localizedName ?? "unknown")")
    
    let pid = frontApp.processIdentifier
    let appElement = AXUIElementCreateApplication(pid)
    var focusedElement: CFTypeRef?
    
    let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)
    
    if result == .success, let element = focusedElement {
        let axElement = element as! AXUIElement
        
        print("Available attributes: \(allAccessibilityAttributes.count)")
        print("---")
        
        for attributeName in allAccessibilityAttributes {
            var attributeValue: CFTypeRef?
            if AXUIElementCopyAttributeValue(axElement, attributeName as CFString, &attributeValue) == .success {
                if let value = attributeValue {
                    print("\(attributeName): \(String(describing: value))")
                } else {
                    print("\(attributeName): nil")
                }
            } else {
                print("\(attributeName): <failed to get value>")
            }
        }
    }
}