import { execPromise, logWithElapsed } from "./utils";
import { Element } from "../types";
import { getSwiftPath } from "../main";
import * as path from "path";

export async function getClickableElements(
  bundleId: string
): Promise<{ clickableElements: Element[] }> {
  logWithElapsed(
    "getClickableElements",
    `Getting clickable elements for bundleId: ${bundleId}`
  );

  const swiftPath = getSwiftPath("click.swift");
  logWithElapsed("getClickableElements", `Using Swift path: ${swiftPath}`);

  try {
    const { stdout: runningCheck } = await execPromise(
      `osascript -e 'tell application "System Events" to return (exists process 1 where bundle identifier is "${bundleId}")'`
    );
    const isRunning = runningCheck.trim() === "true";
    logWithElapsed("getClickableElements", `App running check: ${isRunning}`);
    if (!isRunning) {
      logWithElapsed("getClickableElements", `App not running: ${bundleId}`);
      throw new Error(`App not running: ${bundleId}`);
    }
  } catch (err) {
    logWithElapsed("getClickableElements", `App not running: ${bundleId}`);
    throw new Error(`App not running: ${bundleId}`);
  }

  try {
    const command = `swift ${swiftPath} ${bundleId}`;
    logWithElapsed("getClickableElements", `Executing command: ${command}`);

    const { stdout, stderr } = await execPromise(command, {
      cwd: path.dirname(swiftPath),
    });

    logWithElapsed(
      "getClickableElements",
      `Swift stdout length: ${stdout.length}, stderr length: ${stderr.length}`
    );

    if (stderr) {
      logWithElapsed("getClickableElements", `Swift stderr: ${stderr}`);
    }

    if (stdout.length === 0) {
      logWithElapsed("getClickableElements", `Swift stdout is empty`);
      throw new Error("Swift script returned empty output");
    }

    logWithElapsed(
      "getClickableElements",
      `Swift stdout: ${stdout.substring(0, 200)}...`
    );

    let clickableElements;
    try {
      clickableElements = JSON.parse(stdout);
      logWithElapsed("getClickableElements", `Parsed clickable elements`);
    } catch (err) {
      logWithElapsed("getClickableElements", `JSON parse error: ${stdout}`);
      throw new Error(stdout);
    }
    if (
      typeof clickableElements === "string" &&
      clickableElements.match(/App not running|Error|not found|failed/i)
    ) {
      logWithElapsed(
        "getClickableElements",
        `Error in clickable elements: ${clickableElements}`
      );
      throw new Error(clickableElements);
    }

    if (clickableElements.length < 5) {
      console.log("Could not get elements. Enabling accessibility");
      await execPromise(
        `swift ${getSwiftPath("manualAccessibility.swift")} ${bundleId}`,
        { cwd: path.dirname(getSwiftPath("manualAccessibility.swift")) }
      );
      const { stdout: windowStdout } = await execPromise(
        `swift ${getSwiftPath("windows.swift")} ${bundleId}`,
        { cwd: path.dirname(getSwiftPath("windows.swift")) }
      );
      const windows = JSON.parse(windowStdout);
      const window = windows[0];
      if (!window) {
        console.log("no windows found");
        return { clickableElements };
      }

      const { stdout: coordsStdout } = await execPromise(
        `swift ${getSwiftPath("moveToOpusDisplay.swift")} ${window.pid} "${
          window.name
        }"`,
        { cwd: path.dirname(getSwiftPath("moveToOpusDisplay.swift")) }
      );
      console.log("moved window");

      const { stdout } = await execPromise(
        `swift ${getSwiftPath("click.swift")} ${bundleId}`,
        { cwd: path.dirname(getSwiftPath("click.swift")) }
      );
      try {
        clickableElements = JSON.parse(stdout);
        logWithElapsed("getClickableElements", `Parsed clickable elements`);
      } catch (err) {
        logWithElapsed("getClickableElements", `JSON parse error: ${stdout}`);
        throw new Error(stdout);
      }
      if (
        typeof clickableElements === "string" &&
        clickableElements.match(/App not running|Error|not found|failed/i)
      ) {
        logWithElapsed(
          "getClickableElements",
          `Error in clickable elements: ${clickableElements}`
        );
        throw new Error(clickableElements);
      }
      await execPromise(
        `swift ${getSwiftPath("moveToCoords.swift")} ${window.pid} "${
          window.name
        }" ${coordsStdout}`,
        { cwd: path.dirname(getSwiftPath("moveToCoords.swift")) }
      );
      console.log("moved back");
    }

    return { clickableElements };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    logWithElapsed(
      "getClickableElements",
      `Swift execution error: ${errorMessage}`
    );
    console.error("Full Swift execution error:", { errorMessage, errorStack });
    throw err;
  }
}
