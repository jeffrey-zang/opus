import * as fs from "node:fs";
import * as path from "node:path";
import { execPromise, logWithElapsed } from "./utils";
import { Element } from "../types";

export async function getClickableElements(
  bundleId: string,
  stepFolder: string
): Promise<{ clickableElements: Element[] }> {
  logWithElapsed(
    "getClickableElements",
    `Getting clickable elements for bundleId: ${bundleId}`
  );
  const { stdout } = await execPromise(`swift swift/click.swift ${bundleId}`);
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
    await execPromise(`swift swift/manualAccessibility.swift ${bundleId}`);
    const { stdout: windowStdout } = await execPromise(
      `swift swift/windows.swift ${bundleId}`
    );
    const windows = JSON.parse(windowStdout);
    const window = windows[0];
    if (!window) {
      console.log("no windows found");
      return { clickableElements };
    }
    // TODO: multi window support
    // for (const window of windows) {
    const { stdout: coordsStdout } = await execPromise(
      `swift swift/moveToOpusDisplay.swift ${window.pid} "${window.name}"`
    );
    console.log("moved window");
    // fetch elements again
    const { stdout } = await execPromise(`swift swift/click.swift ${bundleId}`);
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
      `swift swift/moveToCoords.swift ${window.pid} "${window.name}" ${coordsStdout}`
    );
    console.log("moved back");
    // }
  }

  fs.writeFileSync(
    path.join(stepFolder, "clickableElements.json"),
    JSON.stringify(clickableElements, null, 2)
  );
  logWithElapsed("getClickableElements", `Saved clickableElements.json`);
  return { clickableElements };
}
