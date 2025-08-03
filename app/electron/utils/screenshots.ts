import { desktopCapturer } from "electron";
import { execPromise, logWithElapsed } from "./utils";
import { Window } from "../types";
import { getSwiftPath } from "../main";

import * as fs from "node:fs";
import * as path from "node:path";

export async function takeAndSaveScreenshots(
  appName: string,
  stepFolder: string
) {
  if (!fs.existsSync(stepFolder)) {
    fs.mkdirSync(stepFolder, { recursive: true });
  }

  logWithElapsed(
    "takeAndSaveScreenshots",
    `Taking screenshot of app window for app: ${appName}`
  );
  const { stdout: swiftWindowsStdout } = await execPromise(
    `swift ${getSwiftPath("windows.swift")}`,
    { cwd: path.dirname(getSwiftPath("windows.swift")) }
  );
  logWithElapsed("takeAndSaveScreenshots", `Got swift windows`);
  const swiftWindows = JSON.parse(swiftWindowsStdout).filter(
    (window: Window) => window.app === appName
  );
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    fetchWindowIcons: true,
    thumbnailSize: { width: 3840, height: 2160 },
  });
  logWithElapsed("takeAndSaveScreenshots", `Got desktop sources`);
  const matchingPairs = [];
  for (const window of swiftWindows) {
    const source = sources.find(
      (s) => typeof s.name === "string" && s.name === window.name
    );
    if (source) {
      matchingPairs.push({ window, source });
    }
  }
  let screenshotBase64;
  for (const { window, source } of matchingPairs) {
    const image = source.thumbnail;
    if (!image.isEmpty()) {
      console.log(window.name, window.name.replace(" ", "-"));
      const safeName = window.name
        .replace(/[^a-zA-Z0-9\s\-_\.]/g, "_")
        .replace(/\s+/g, "_")
        .substring(0, 100);
      const screenshotPath = path.join(
        stepFolder,
        `screenshot-${safeName}.png`
      );
      fs.writeFileSync(screenshotPath, image.toPNG());
      logWithElapsed(
        "takeAndSaveScreenshots",
        `Saved screenshot: ${screenshotPath}`
      );
      if (!screenshotBase64) {
        screenshotBase64 = fs.readFileSync(screenshotPath).toString("base64");
      }
    }
  }
  return screenshotBase64;
}
