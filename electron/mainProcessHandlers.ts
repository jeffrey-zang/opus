import { ipcMain, screen, BrowserWindow } from "electron";
import { run } from "@openai/agents";
import { appSelectionAgent, actionAgent } from "./ai";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

const execPromise = promisify(exec);

export function setupMainHandlers({ win }: { win: BrowserWindow | null }) {
  let lastLogTime = Date.now();
  function logWithElapsed(message: string) {
    const now = Date.now();
    const elapsed = now - lastLogTime;
    lastLogTime = now;
    console.log(`[${elapsed}ms] ${message}`);
  }

  ipcMain.on("resize", async (event, w, h) => {
    logWithElapsed("resize event received");
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    if (win) {
      const [winWidth] = win.getSize();
      const x = Math.round(width * 0.85 - winWidth / 2);
      win.setPosition(x, 50, true);
    }
    win?.setSize(w, h, true);
    logWithElapsed("resize event handled");
  });

  ipcMain.on("message", async (event, userPrompt) => {
    logWithElapsed("message event received");
    const history: { action: string }[] = [];
    const appNameResult = await run(appSelectionAgent, [
      { role: "user", content: userPrompt },
    ]);
    logWithElapsed("appSelectionAgent run complete");
    const appName =
      appNameResult.state._currentStep &&
      "output" in appNameResult.state._currentStep
        ? appNameResult.state._currentStep.output.trim()
        : undefined;
    if (!appName) {
      logWithElapsed("Could not determine app");
      event.sender.send("reply", {
        type: "error",
        message: "Could not determine app.",
      });
      return;
    }
    let bundleId;
    try {
      const { stdout } = await execPromise(
        `osascript -e 'id of app "${appName}"'`
      );
      bundleId = stdout.trim();
      logWithElapsed(`Got bundleId: ${bundleId}`);
    } catch {
      logWithElapsed(`Could not get bundle id for ${appName}`);
      event.sender.send("reply", {
        type: "error",
        message: `Could not get bundle id for ${appName}`,
      });
      return;
    }
    let clickableElementMap: Map<string, unknown> = new Map();
    let done = false;
    while (!done) {
      let clickableElements: unknown[] = [];
      try {
        const { stdout } = await execPromise(
          `swift swift/click.swift ${bundleId}`
        );
        clickableElements = JSON.parse(stdout);
        clickableElementMap = new Map();
        if (Array.isArray(clickableElements)) {
          for (const el of clickableElements) {
            if (typeof el === "object" && el !== null) {
              const rec = el as Record<string, unknown>;
              if (rec.id !== undefined)
                clickableElementMap.set(String(rec.id), el);
              if (rec.elementId !== undefined)
                clickableElementMap.set(String(rec.elementId), el);
            }
          }
        }
        // Save to JSON files
        const promptFolderName = userPrompt
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const promptFolder = path.join(process.cwd(), "logs", promptFolderName);
        if (!fs.existsSync(promptFolder)) {
          fs.mkdirSync(promptFolder, { recursive: true });
        }
        const timestamp = Date.now().toString();
        const timestampFolder = path.join(promptFolder, timestamp);
        if (!fs.existsSync(timestampFolder)) {
          fs.mkdirSync(timestampFolder, { recursive: true });
        }
        fs.writeFileSync(
          path.join(timestampFolder, "clickableElements.json"),
          JSON.stringify(clickableElements, null, 2)
        );
        fs.writeFileSync(
          path.join(timestampFolder, "clickableElementMap.json"),
          JSON.stringify(Array.from(clickableElementMap.entries()), null, 2)
        );
        logWithElapsed("Got clickable elements");
      } catch {
        logWithElapsed("Could not get clickable elements");
        event.sender.send("reply", {
          type: "error",
          message: "Could not get clickable elements.",
        });
        return;
      }
      const agentInput: {
        userPrompt: string;
        clickableElements: unknown[];
        history: { action: string }[];
      } = {
        userPrompt,
        clickableElements,
        history,
      };
      logWithElapsed("Running actionAgent");
      const actionResult = await run(actionAgent, [
        { role: "user", content: JSON.stringify(agentInput) },
      ]);
      logWithElapsed("actionAgent run complete");
      const action: string | undefined =
        actionResult.state._currentStep &&
        "output" in actionResult.state._currentStep
          ? actionResult.state._currentStep.output.trim()
          : undefined;
      if (!action) {
        logWithElapsed("No action returned");
        event.sender.send("reply", {
          type: "error",
          message: "No action returned.",
        });
        return;
      }
      if (action === "done") {
        logWithElapsed("Task complete");
        event.sender.send("reply", {
          type: "complete",
          message: "Task complete.",
        });
        done = true;
        break;
      }
      if (action.startsWith("click ")) {
        const id = action.split(" ")[1];
        const element = clickableElementMap.get(id);

        logWithElapsed(`Clicking id: ${id}`);
        if (element) {
          console.log(`Clicked element info: ${JSON.stringify(element)}`);
        }
        await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
        history.push({ action });
        logWithElapsed(`Clicked id: ${id}`);
      } else if (action.startsWith("key ")) {
        const keyString = action.slice(4);
        logWithElapsed(`Sending key: ${keyString}`);
        await execPromise(`swift swift/key.swift ${bundleId} "${keyString}"`);
        history.push({ action });
        logWithElapsed(`Sent key: ${keyString}`);
      } else {
        logWithElapsed(`Unknown action: ${action}`);
        event.sender.send("reply", {
          type: "error",
          message: `Unknown action: ${action}`,
        });
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}
