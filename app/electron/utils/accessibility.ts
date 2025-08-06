import { execPromise, logWithElapsed } from "./utils";
import { Notification } from "electron";

export interface AccessibilityStatus {
  isEnabled: boolean;
  needsPermission: boolean;
}

/**
 * Check if accessibility permissions are enabled for the current app
 */
export async function checkAccessibilityPermissions(): Promise<AccessibilityStatus> {
  try {
    logWithElapsed("accessibility", "Checking accessibility permissions...");

    const swiftCheckScript = `import AppKit

let trusted = AXIsProcessTrusted()
print(trusted ? "true" : "false")`;

    const result = await execPromise(`echo '${swiftCheckScript}' | swift -`);
    const isEnabled = result.stdout.trim() === "true";

    logWithElapsed("accessibility", `Accessibility enabled: ${isEnabled}`);

    return {
      isEnabled,
      needsPermission: !isEnabled,
    };
  } catch (error) {
    logWithElapsed("accessibility", `Error checking accessibility: ${error}`);
    // If we can't check, assume we need permission
    return {
      isEnabled: false,
      needsPermission: true,
    };
  }
}

/**
 * Request accessibility permissions by opening System Settings
 */
export async function requestAccessibilityPermissions(): Promise<void> {
  try {
    logWithElapsed("accessibility", "Requesting accessibility permissions...");

    await execPromise(
      `open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"`
    );

    logWithElapsed(
      "accessibility",
      "Opened System Settings to Accessibility preferences"
    );
  } catch (error) {
    logWithElapsed("accessibility", `Error opening System Settings: ${error}`);
    throw error;
  }
}

/**
 * Show a notification to guide the user to enable accessibility
 */
export function showAccessibilityNotification(): void {
  try {
    new Notification({
      title: "Accessibility Permission Required",
      body: "Opus needs accessibility access to control your apps. Please enable it in System Settings.",
      silent: false,
    }).show();
  } catch (error) {
    logWithElapsed("accessibility", `Error showing notification: ${error}`);
  }
}
