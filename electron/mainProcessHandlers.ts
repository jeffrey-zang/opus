import { ipcMain, screen, BrowserWindow, desktopCapturer } from "electron";
import { run } from "@openai/agents";
import { appSelectionAgent, actionAgent } from "./ai";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

interface Window {
  pid: string;
  name: string;
  app: string;
}

const execPromise = promisify(exec);

let lastLogTime = Date.now();
function logWithElapsed(functionName: string, message: string) {
  const now = Date.now();
  const elapsed = now - lastLogTime;
  lastLogTime = now;
  console.log(`[${functionName}] [${elapsed}ms] ${message}`);
}

async function getAppName(userPrompt: string) {
  logWithElapsed(
    "getAppName",
    `Start getAppName with userPrompt: ${userPrompt}`
  );
  const appNameResult = await run(appSelectionAgent, [
    { role: "user", content: userPrompt },
  ]);
  logWithElapsed(
    "getAppName",
    `Result: ${
      appNameResult.state._currentStep &&
      "output" in appNameResult.state._currentStep
        ? appNameResult.state._currentStep.output.trim()
        : undefined
    }`
  );
  return appNameResult.state._currentStep &&
    "output" in appNameResult.state._currentStep
    ? appNameResult.state._currentStep.output.trim()
    : undefined;
}

async function getBundleId(appName: string) {
  logWithElapsed("getBundleId", `Getting bundle id for app: ${appName}`);
  const { stdout } = await execPromise(`osascript -e 'id of app "${appName}"'`);
  logWithElapsed("getBundleId", `Bundle id result: ${stdout.trim()}`);
  return stdout.trim();
}

function createLogFolder(userPrompt: string) {
  logWithElapsed(
    "createLogFolder",
    `Creating log folder for prompt: ${userPrompt}`
  );
  const mainTimestamp = Date.now().toString();
  const promptFolderName = userPrompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const mainLogFolder = path.join(
    process.cwd(),
    "logs",
    `${mainTimestamp}-${promptFolderName}`
  );
  if (!fs.existsSync(mainLogFolder)) {
    fs.mkdirSync(mainLogFolder, { recursive: true });
    logWithElapsed("createLogFolder", `Created folder: ${mainLogFolder}`);
  }
  return mainLogFolder;
}

async function getClickableElements(bundleId: string, stepFolder: string) {
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
  fs.writeFileSync(
    path.join(stepFolder, "clickableElements.json"),
    JSON.stringify(clickableElements, null, 2)
  );
  logWithElapsed("getClickableElements", `Saved clickableElements.json`);
  return { clickableElements };
}

async function takeAndSaveScreenshots(appName: string, stepFolder: string) {
  logWithElapsed(
    "takeAndSaveScreenshots",
    `Taking screenshot of app window for app: ${appName}`
  );
  const { stdout: swiftWindowsStdout } = await execPromise(
    `swift swift/windows.swift`
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
      const screenshotPath = path.join(
        stepFolder,
        `screenshot-${window.name.replace(" ", "-")}.png`
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

interface Element {
  AXRole?: string;
  AXTitle?: string;
  AXHelp?: string;
  AXValue?: string;
  AXURL?: string;
  AXDescription?: string;
  id: number;
}

async function runActionAgent(
  appName: string,
  userPrompt: string,
  clickableElements: Element[],
  history: { action: string; element?: Element }[],
  screenshotBase64?: string,
  stepFolder?: string
) {
  logWithElapsed("runActionAgent", `Running action agent for app: ${appName}`);
  let parsedClickableElements: string = "";
  for (let i = 0; i < clickableElements.length; i++) {
    const element: Element = clickableElements[i];
    parsedClickableElements +=
      `${element.id} ${element.AXRole !== "" ? `${element.AXRole} ` : ""}${
        element.AXTitle !== "" ? `${element.AXTitle} ` : ""
      }${element.AXValue !== "" ? `${element.AXValue} ` : ""}${
        element.AXHelp !== "" ? `${element.AXHelp} ` : ""
      }${element.AXDescription !== "" ? `${element.AXDescription} ` : ""}` +
      "\n";
  }

  let parsedHistory = "";
  for (const h of history) {
    if (h.action.startsWith("click ") && h.element) {
      const e = h.element;
      parsedHistory +=
        `click ${e.id} ${e.AXRole !== "" ? `${e.AXRole} ` : ""}${
          e.AXTitle !== "" ? `${e.AXTitle} ` : ""
        }${e.AXValue !== "" ? `${e.AXValue} ` : ""}${
          e.AXHelp !== "" ? `${e.AXHelp} ` : ""
        }${e.AXDescription !== "" ? `${e.AXDescription} ` : ""}`.trim() + "\n";
    } else if (h.action.startsWith("key ")) {
      parsedHistory += h.action + "\n";
    }
  }

  const contentText =
    `You are operating on the app: ${appName}.\n\n` +
    `User prompt (the task you must complete): ${userPrompt}\n\n` +
    `Here is a list of clickable elements:\n${parsedClickableElements}\n\n` +
    `Action history so far:\n${
      parsedHistory
        ? parsedHistory
        : "No actions have been completed yet (this is the first action)."
    }`;

  if (stepFolder) {
    fs.writeFileSync(path.join(stepFolder, "agent-prompt.txt"), contentText);
    logWithElapsed("runActionAgent", `Saved agent-prompt.txt`);
  }

  const agentInput: {
    role: "user";
    content: (
      | { type: "input_text"; text: string }
      | { type: "input_image"; image: string }
    )[];
  }[] = [
    {
      role: "user",
      content: [
        { type: "input_text" as const, text: contentText },
        ...(screenshotBase64
          ? [
              {
                type: "input_image" as const,
                image: `data:image/png;base64,${screenshotBase64}`,
              },
            ]
          : []),
      ],
    },
  ];

  const actionResult = await run(actionAgent, agentInput);
  logWithElapsed(
    "runActionAgent",
    `Action agent result: ${
      actionResult.state._currentStep &&
      "output" in actionResult.state._currentStep
        ? actionResult.state._currentStep.output.trim()
        : undefined
    }`
  );
  return actionResult.state._currentStep &&
    "output" in actionResult.state._currentStep
    ? actionResult.state._currentStep.output.trim()
    : undefined;
}

async function performAction(
  action: string,
  bundleId: string,
  clickableElements: unknown[]
) {
  logWithElapsed("performAction", `Performing action: ${action}`);
  if (action.startsWith("click ")) {
    const id = action.split(" ")[1];
    const element = (clickableElements as Element[]).find((el) => {
      if (typeof el === "object" && el !== null) {
        const rec = el as unknown as Record<string, unknown>;
        return String(rec.id) === id || String(rec.elementId) === id;
      }
      return false;
    });
    if (element) {
      logWithElapsed(
        "performAction",
        `Clicked element info: ${JSON.stringify(element)}`
      );
    }
    await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
    logWithElapsed("performAction", `Executed click for id: ${id}`);
    return { type: "click", id };
  } else if (action.startsWith("key ")) {
    const keyString = action.slice(4);
    await execPromise(`swift swift/key.swift ${bundleId} "${keyString}"`);
    logWithElapsed("performAction", `Executed key: ${keyString}`);
    return { type: "key", keyString };
  } else {
    logWithElapsed("performAction", `Unknown action: ${action}`);
    return { type: "unknown" };
  }
}

export function setupMainHandlers({ win }: { win: BrowserWindow | null }) {
  ipcMain.on("resize", async (event, w, h) => {
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
    const history: { action: string; element?: Element }[] = [];
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
        `Could not get bundle id for ${appName}`
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
        logWithElapsed("setupMainHandlers", "Got clickable elements");
      } catch (err) {
        logWithElapsed(
          "setupMainHandlers",
          `Could not get clickable elements: ${
            err instanceof Error ? err.stack || err.message : String(err)
          }`
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
          }`
        );
      }

      const action = await runActionAgent(
        appName,
        userPrompt,
        clickableElements,
        history,
        screenshotBase64,
        stepFolder
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
      if (action === "done") {
        logWithElapsed("setupMainHandlers", "Task complete");
        event.sender.send("reply", {
          type: "complete",
          message: "Task complete.",
        });
        done = true;
        break;
      }

      const actionResult = await performAction(
        action,
        bundleId,
        clickableElements
      );
      if (actionResult.type === "click") {
        const id = action.split(" ")[1];
        const element = (clickableElements as Element[]).find((el) => {
          if (typeof el === "object" && el !== null) {
            const rec = el as unknown as Record<string, unknown>;
            return String(rec.id) === id || String(rec.elementId) === id;
          }
          return false;
        });
        history.push({ action, element });
        logWithElapsed("setupMainHandlers", `Clicked id: ${actionResult.id}`);
      } else if (actionResult.type === "key") {
        history.push({ action });
        logWithElapsed(
          "setupMainHandlers",
          `Sent key: ${actionResult.keyString}`
        );
      } else {
        logWithElapsed("setupMainHandlers", `Unknown action: ${action}`);
        event.sender.send("reply", {
          type: "error",
          message: `Unknown action: ${action}`,
        });
        return;
      }
      console.log("\n");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}
