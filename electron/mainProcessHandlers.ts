import { BrowserWindow, ipcMain, Notification, screen } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAppName, getBundleId } from "./getAppInfo";
import { getClickableElements } from "./getClickableElements";
import { runActionAgent } from "./runAgents";
import { takeAndSaveScreenshots } from "./screenshots";
import { Element } from "./types";
import { logWithElapsed } from "./utils";
import { performAction } from "./performAction";

function createLogFolder(userPrompt: string) {
  logWithElapsed(
    "createLogFolder",
    `Creating log folder for prompt: ${userPrompt}`,
  );
  const mainTimestamp = Date.now().toString();
  const promptFolderName = userPrompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const mainLogFolder = path.join(
    process.cwd(),
    "logs",
    `${mainTimestamp}-${promptFolderName}`,
  );
  if (!fs.existsSync(mainLogFolder)) {
    fs.mkdirSync(mainLogFolder, { recursive: true });
    logWithElapsed("createLogFolder", `Created folder: ${mainLogFolder}`);
  }
  return mainLogFolder;
}

export function setupMainHandlers({ win }: { win: BrowserWindow | null }) {
  ipcMain.on("resize", async (_, w, h) => {
    logWithElapsed("setupMainHandlers", "resize event received");
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    if (win) {
      const [winWidth] = win.getSize();
      const x = Math.round(width * 0.85 - winWidth / 2);
      win.setPosition(x, 50, true);
    }
    win?.setSize(w, h, true);
    logWithElapsed("setupMainHandlers", "resize event handled");
  });

  ipcMain.on("message", async (event, userPrompt) => {
    logWithElapsed("setupMainHandlers", "message event received");
    // TODO: completely rework this this sucks
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const history: { action: string; [k: string]: any }[] = [];
    let appName;
    try {
      appName = await getAppName(userPrompt);
    } catch {
      logWithElapsed("setupMainHandlers", "Could not determine app");
      event.sender.send("reply", {
        type: "error",
        message: "Could not determine app.",
      });
      return;
    }
    logWithElapsed("setupMainHandlers", "appSelectionAgent run complete");
    if (!appName) {
      logWithElapsed("setupMainHandlers", "Could not determine app");
      event.sender.send("reply", {
        type: "error",
        message: "Could not determine app.",
      });
      return;
    }
    let bundleId;
    try {
      bundleId = await getBundleId(appName);
      logWithElapsed("setupMainHandlers", `Got bundleId: ${bundleId}`);
    } catch {
      logWithElapsed(
        "setupMainHandlers",
        `Could not get bundle id for ${appName}`,
      );
      event.sender.send("reply", {
        type: "error",
        message: `Could not get bundle id for ${appName}`,
      });
      return;
    }
    const mainLogFolder = createLogFolder(userPrompt);
    console.log("\n");

    let done = false;
    while (!done) {
      const stepTimestamp = Date.now().toString();
      const stepFolder = path.join(mainLogFolder, `${stepTimestamp}`);
      if (!fs.existsSync(stepFolder)) {
        fs.mkdirSync(stepFolder, { recursive: true });
      }
      let clickableElements;
      try {
        const result = await getClickableElements(bundleId, stepFolder);
        clickableElements = result.clickableElements;
        console.log("found " + clickableElements.length + " elements");
        logWithElapsed("setupMainHandlers", "Got clickable elements");
      } catch (err) {
        logWithElapsed(
          "setupMainHandlers",
          `Could not get clickable elements: ${
            err instanceof Error ? err.stack || err.message : String(err)
          }`,
        );
        event.sender.send("reply", {
          type: "error",
          message: `Could not get clickable elements. ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
        return;
      }
      let screenshotBase64;
      try {
        screenshotBase64 = await takeAndSaveScreenshots(appName, stepFolder);
      } catch (err) {
        logWithElapsed(
          "setupMainHandlers",
          `Could not take screenshot: ${
            err instanceof Error ? err.stack || err.message : String(err)
          }`,
        );
      }

      const action = await runActionAgent(
        appName,
        userPrompt,
        clickableElements,
        history,
        screenshotBase64,
        stepFolder,
      );
      logWithElapsed("setupMainHandlers", "actionAgent run complete");
      if (!action) {
        logWithElapsed("setupMainHandlers", "No action returned");
        event.sender.send("reply", {
          type: "error",
          message: "No action returned.",
        });
        return;
      }
      if (action === "done" || action === "(done)" || action.endsWith("STOP")) {
        logWithElapsed("setupMainHandlers", "Task complete");
        event.sender.send("reply", {
          type: "complete",
          message: "Task complete.",
        });
        new Notification({
          title: "Task complete",
          body: "Opus's task is complete!",
        }).show();
        done = true;
        break;
      }

      const actionResult = await performAction(
        action,
        bundleId,
        clickableElements,
        event,
      );
      switch (actionResult.type) {
        case "applescript": {
          history.push({
            action,
            actionResult,
            script: actionResult.script ?? "",
            error: actionResult.error ?? "",
          });
          break;
        }
        case "click": {
          const id = action.split(" ")[1];
          const element = (clickableElements as Element[]).find((el) => {
            if (typeof el === "object" && el !== null) {
              const rec = el as unknown as Record<string, unknown>;
              return String(rec.id) === id || String(rec.elementId) === id;
            }
            return false;
          });
          history.push({ action, actionResult, element });
          logWithElapsed("setupMainHandlers", `Clicked id: ${actionResult.id}`);
          break;
        }
        case "key": {
          history.push({ action, actionResult });
          logWithElapsed(
            "setupMainHandlers",
            `Sent key: ${actionResult.keyString}`,
          );
          break;
        }
        default: {
          logWithElapsed("setupMainHandlers", `Unknown action: ${action}`);
          event.sender.send("reply", {
            type: "error",
            message: `Unknown action: ${action}`,
          });
          return;
        }
      }
      console.log("\n");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}
