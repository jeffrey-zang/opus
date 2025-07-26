import { BrowserWindow, ipcMain, Notification, screen } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { getAppName, getBundleId } from "./utils/getAppInfo";
import { getClickableElements } from "./utils/getClickableElements";
import { runActionAgentStreaming } from "./ai/runAgents";
import { takeAndSaveScreenshots } from "./utils/screenshots";
import { execPromise, logWithElapsed } from "./utils/utils";
import { performAction } from "./performAction";
import { AgentInputItem } from "@openai/agents";

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
      win.setSize(500, 500, true);
      firstPromptReceived = true;
    }
    logWithElapsed("setupMainHandlers", "message event received");
    const history: AgentInputItem[] = [];
    let appName;
    try {
      appName = await getAppName(userPrompt);
      await execPromise(`open -ga "${appName}"`);
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
        console.log("found " + clickableElements.length + " elements");
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

      let action = "";
      let hasToolCall = false;

      const streamGenerator = runActionAgentStreaming(
        appName,
        userPrompt,
        clickableElements,
        history,
        screenshotBase64,
        stepFolder,
        async (toolName: string, args: string) => {
          // Execute tool call
          const actionResult = await performAction(
            `=${toolName}\n${args}`,
            bundleId,
            clickableElements,
            event
          );
          
          let resultText = "";
          if (Array.isArray(actionResult)) {
            // Handle array of results
            const firstResult = actionResult[0];
            if (firstResult && "type" in firstResult && firstResult.type === "unknown tool") {
              resultText = "Error: unknown tool. Is the tool name separated from the arguments with a new line?";
            } else if (firstResult && "error" in firstResult && firstResult.error) {
              resultText = `Error:\n${firstResult.error}`;
            } else if (firstResult && "stdout" in firstResult && firstResult.stdout) {
              resultText = `Success. Stdout:\n${firstResult.stdout}`;
            } else {
              resultText = "Success";
            }
          } else {
            // Handle single result
            if ("type" in actionResult && actionResult.type === "unknown tool") {
              resultText = "Error: unknown tool. Is the tool name separated from the arguments with a new line?";
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
              content: chunk.content
            });
            action += chunk.content;
            break;
          case "tool_start":
            event.sender.send("stream", {
              type: "tool_start",
              toolName: chunk.toolName
            });
            hasToolCall = true;
            break;
          case "tool_args":
            event.sender.send("stream", {
              type: "tool_args",
              content: chunk.content
            });
            break;
          case "tool_execute":
            event.sender.send("stream", {
              type: "tool_execute",
              toolName: chunk.toolName
            });
            break;
          case "tool_result":
            event.sender.send("stream", {
              type: "tool_result",
              content: chunk.content
            });
            break;
        }
      }
      
      // Send a completion signal to frontend
      if (!hasToolCall && action.trim()) {
        // This was just text, mark streaming as complete for this chunk
        setTimeout(() => {
          event.sender.send("stream", { type: "chunk_complete" });
        }, 50);
      }

      logWithElapsed("setupMainHandlers", "actionAgent run complete");
      if (!action && !hasToolCall) {
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

      // Add to history after each interaction
      if (action.trim() || hasToolCall) {
        history.push({
          role: "assistant",
          content: [{ type: "output_text", text: action }],
          status: "completed",
        });
      }
      console.log("\n");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}
