import { BrowserWindow, ipcMain, Notification, screen } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAppName, getBundleId } from "./utils/getAppInfo";
import { getClickableElements } from "./utils/getClickableElements";
import { takeAndSaveScreenshots } from "./utils/screenshots";
import { execPromise, logWithElapsed } from "./utils/utils";
import { performAction } from "./performAction";
import {
  runConversationalAgent,
  createInitialState,
  ConversationState,
} from "./ai/conversationalAgent";

// Global conversation state
let conversationState: ConversationState = createInitialState();

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

export function setupMainHandlers({ win }: { win: BrowserWindow | null }) {
  let firstPromptReceived = false;

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
    if (!firstPromptReceived && win) {
      win.setSize(800, 600, true);
      firstPromptReceived = true;
    }

    logWithElapsed("setupMainHandlers", "message event received");

    // Create log folder for this conversation
    const mainLogFolder = createLogFolder(userPrompt);
    const stepTimestamp = Date.now().toString();
    const stepFolder = path.join(mainLogFolder, `${stepTimestamp}`);
    if (!fs.existsSync(stepFolder)) {
      fs.mkdirSync(stepFolder, { recursive: true });
    }

    try {
      // Determine which app to use (if this is the first message)
      if (!conversationState.currentApp) {
        const appName = await getAppName(userPrompt);
        if (appName) {
          await execPromise(`open -ga "${appName}"`);
          conversationState.currentApp = appName;

          // Get bundle ID for the app
          const bundleId = await getBundleId(appName);

          // Get clickable elements and screenshot
          const result = await getClickableElements(bundleId, stepFolder);
          conversationState.clickableElements = result.clickableElements;

          const screenshotBase64 = await takeAndSaveScreenshots(
            appName,
            stepFolder
          );
          conversationState.screenshotBase64 = screenshotBase64;
        }
      } else {
        // Update context for existing app
        const bundleId = await getBundleId(conversationState.currentApp);
        const result = await getClickableElements(bundleId, stepFolder);
        conversationState.clickableElements = result.clickableElements;

        const screenshotBase64 = await takeAndSaveScreenshots(
          conversationState.currentApp,
          stepFolder
        );
        conversationState.screenshotBase64 = screenshotBase64;
      }

      // Run the conversational agent
      const streamGenerator = runConversationalAgent(
        userPrompt,
        conversationState,
        async (toolName: string, args: string) => {
          // Execute tool call
          const actionResult = await performAction(
            `=${toolName}\n${args}`,
            conversationState.currentApp
              ? await getBundleId(conversationState.currentApp)
              : "",
            conversationState.clickableElements,
            event
          );

          let resultText = "";
          if (Array.isArray(actionResult)) {
            const firstResult = actionResult[0];
            if (
              firstResult &&
              "type" in firstResult &&
              firstResult.type === "unknown tool"
            ) {
              resultText =
                "Error: unknown tool. Is the tool name separated from the arguments with a new line?";
            } else if (
              firstResult &&
              "error" in firstResult &&
              firstResult.error
            ) {
              resultText = `Error:\n${firstResult.error}`;
            } else if (
              firstResult &&
              "stdout" in firstResult &&
              firstResult.stdout
            ) {
              resultText = `Success. Stdout:\n${firstResult.stdout}`;
            } else {
              resultText = "Success";
            }
          } else {
            if (
              "type" in actionResult &&
              actionResult.type === "unknown tool"
            ) {
              resultText =
                "Error: unknown tool. Is the tool name separated from the arguments with a new line?";
            } else if ("error" in actionResult && actionResult.error) {
              resultText = `Error:\n${actionResult.error}`;
            } else if ("stdout" in actionResult && actionResult.stdout) {
              resultText = `Success. Stdout:\n${actionResult.stdout}`;
            } else {
              resultText = "Success";
            }
          }

          return resultText;
        }
      );

      // Stream tokens and handle tool calls
      for await (const chunk of streamGenerator) {
        switch (chunk.type) {
          case "text":
            event.sender.send("stream", {
              type: "text",
              content: chunk.content,
            });
            break;
          case "tool_start":
            event.sender.send("stream", {
              type: "tool_start",
              toolName: chunk.toolName,
            });
            break;
          case "tool_args":
            event.sender.send("stream", {
              type: "tool_args",
              content: chunk.content,
            });
            break;
          case "tool_execute":
            event.sender.send("stream", {
              type: "tool_execute",
              toolName: chunk.toolName,
            });
            break;
          case "tool_result":
            event.sender.send("stream", {
              type: "tool_result",
              content: chunk.content,
            });
            break;
          case "complete":
            logWithElapsed(
              "setupMainHandlers",
              "Conversational agent completed"
            );
            event.sender.send("reply", {
              type: "complete",
              message: "Task complete.",
            });
            new Notification({
              title: "Task complete",
              body: "Opus's task is complete!",
            }).show();
            return;
        }
      }

      // Save conversation state to log
      fs.writeFileSync(
        path.join(stepFolder, "conversation-state.json"),
        JSON.stringify(conversationState, null, 2)
      );
    } catch (error) {
      logWithElapsed(
        "setupMainHandlers",
        `Error in conversational agent: ${
          error instanceof Error ? error.stack || error.message : String(error)
        }`
      );
      event.sender.send("reply", {
        type: "error",
        message: `Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });

  // Add handler to reset conversation
  ipcMain.on("reset-conversation", () => {
    conversationState = createInitialState();
    logWithElapsed("setupMainHandlers", "Conversation reset");
  });

  // Add handler to change app
  ipcMain.on("change-app", async (event, appName: string) => {
    try {
      await execPromise(`open -ga "${appName}"`);
      conversationState.currentApp = appName;

      const bundleId = await getBundleId(appName);
      const stepFolder = path.join(process.cwd(), "logs", "temp");
      if (!fs.existsSync(stepFolder)) {
        fs.mkdirSync(stepFolder, { recursive: true });
      }

      const result = await getClickableElements(bundleId, stepFolder);
      conversationState.clickableElements = result.clickableElements;

      const screenshotBase64 = await takeAndSaveScreenshots(
        appName,
        stepFolder
      );
      conversationState.screenshotBase64 = screenshotBase64;

      event.sender.send("app-changed", { appName });
    } catch (error) {
      event.sender.send("reply", {
        type: "error",
        message: `Failed to change app: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
}
