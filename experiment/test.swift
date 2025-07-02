import Cocoa
import ApplicationServices

func setTextInBackgroundApp() {
    let appName = "TextEdit"
    let options: CFDictionary = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    guard AXIsProcessTrustedWithOptions(options) else {
        print("Enable Accessibility permissions for this app in System Preferences.")
        return
    }

    // Get running app's PID
    guard let runningApp = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.TextEdit").first else {
        print("TextEdit is not running")
        return
    }
    let appElement = AXUIElementCreateApplication(runningApp.processIdentifier)

    // Get windows
    var value: AnyObject?
    AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &value)
    guard let windows = value as? [AXUIElement], let window = windows.first else {
        print("No window found")
        return
    }

    // Get text area (usually the main text view)
    var textAreaValue: AnyObject?
    AXUIElementCopyAttributeValue(window, kAXChildrenAttribute as CFString, &textAreaValue)
    guard let children = textAreaValue as? [AXUIElement] else {
        print("No children found")
        return
    }

    // For TextEdit, the text area is the first child; you may need to traverse deeper for other apps
    let textArea = children[0]

    // Set the value directly
    let textToSet = "Hello from Accessibility API without activating app"
    let setResult = AXUIElementSetAttributeValue(textArea, kAXValueAttribute as CFString, textToSet as CFTypeRef)

    if setResult == .success {
        print("Text set successfully!")
    } else {
        print("Failed to set text:", setResult.rawValue)
    }
}

setTextInBackgroundApp()

