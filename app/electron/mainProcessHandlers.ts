import { BrowserWindow, ipcMain, Notification, screen } from "electron";
import { getAppName, getBundleId } from "./utils/getAppInfo";
import { getClickableElements } from "./utils/getClickableElements";
import { runActionAgent } from "./ai/runAgents";
import { takeAndSaveScreenshots } from "./utils/screenshots";
import { execPromise, logWithElapsed } from "./utils/utils";
import { performAction } from "./performAction";
import { AgentInputItem } from "@openai/agents";
import { TMPDIR } from "./main";
import * as path from "path";
import {
  checkAccessibilityPermissions,
  requestAccessibilityPermissions,
  showAccessibilityNotification,
} from "./utils/accessibility";

export function setupMainHandlers({ win }: { win: BrowserWindow | null }) {
  let firstPromptReceived = false;
  let accessibilityCheckInterval: NodeJS.Timeout | null = null;
  let shouldStop = false;

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

  ipcMain.on("stop", () => {
    logWithElapsed("setupMainHandlers", "Stop signal received");
    shouldStop = true;
  });

  ipcMain.on("message", async (event, userPrompt) => {
    shouldStop = false;

    if (!firstPromptReceived && win) {
      win.setSize(500, 500, true);
      firstPromptReceived = true;
    }
    logWithElapsed("setupMainHandlers", "message event received");

    try {
      const accessibilityStatus = await checkAccessibilityPermissions();

      if (accessibilityStatus.needsPermission) {
        logWithElapsed("setupMainHandlers", "Accessibility permissions needed");

        showAccessibilityNotification();

        await requestAccessibilityPermissions();

        if (!accessibilityCheckInterval) {
          accessibilityCheckInterval = setInterval(async () => {
            try {
              const status = await checkAccessibilityPermissions();
              if (status.isEnabled) {
                logWithElapsed(
                  "setupMainHandlers",
                  "Accessibility permissions now enabled"
                );
                if (accessibilityCheckInterval) {
                  clearInterval(accessibilityCheckInterval);
                  accessibilityCheckInterval = null;
                }

                if (win) {
                  win.webContents.send("accessibility-enabled");
                }
              }
            } catch (error) {
              logWithElapsed(
                "setupMainHandlers",
                `Error in accessibility check: ${error}`
              );
            }
          }, 2000);
        }

        event.sender.send("reply", {
          type: "error",
          message:
            "Opus needs accessibility permissions to control your apps. Please enable it in System Settings and try again.",
        });
        return;
      }

      logWithElapsed(
        "setupMainHandlers",
        "Accessibility permissions confirmed"
      );
    } catch (error) {
      logWithElapsed(
        "setupMainHandlers",
        `Error checking accessibility: ${error}`
      );
      event.sender.send("reply", {
        type: "error",
        message:
          "Could not verify accessibility permissions. Please ensure Opus has accessibility access in System Settings.",
      });
      return;
    }

    const history: AgentInputItem[] = [];
    let appName;
    try {
      appName = await getAppName(userPrompt);
      logWithElapsed("setupMainHandlers", `Selected app: ${appName}`);

      try {
        const { stdout: appCheck } = await execPromise(
          `ls "/Applications/${appName}.app"`
        );
        logWithElapsed("setupMainHandlers", `App exists: ${appCheck.trim()}`);
      } catch (err) {
        logWithElapsed("setupMainHandlers", `App not found: ${appName}`);
        event.sender.send("reply", {
          type: "error",
          message: `App not found: ${appName}`,
        });
        return;
      }

      await execPromise(`open -ga "${appName}"`);
      logWithElapsed("setupMainHandlers", `Opened app: ${appName}`);
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

    event.sender.send("app-info", {
      appName: appName,
      status: "opening",
    });
    let bundleId;
    try {
      bundleId = await getBundleId(appName);
      logWithElapsed("setupMainHandlers", `Got bundleId: ${bundleId}`);

      event.sender.send("app-info", {
        appName: appName,
        bundleId: bundleId,
        status: "ready",
      });
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
    console.log("\n");

    let done = false;
    while (!done && !shouldStop) {
      let clickableElements;
      try {
        const result = await getClickableElements(bundleId);
        clickableElements = result.clickableElements;
        console.log("found " + clickableElements.length + " elements");
        logWithElapsed("setupMainHandlers", "Got clickable elements");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : "";
        const fullError = `Error: ${errorMessage}\nStack: ${errorStack}`;

        logWithElapsed(
          "setupMainHandlers",
          `Could not get clickable elements: ${errorMessage}`
        );

        console.error("Full error details:", fullError);

        event.sender.send("reply", {
          type: "error",
          message: `Could not get clickable elements. ${errorMessage}`,
        });
        return;
      }
      let screenshotBase64;
      try {
        const stepFolder = path.join(TMPDIR, `step-${Date.now()}`);
        screenshotBase64 = await takeAndSaveScreenshots(appName, stepFolder);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logWithElapsed(
          "setupMainHandlers",
          `Could not take screenshot: ${errorMessage}`
        );

        event.sender.send("reply", {
          type: "error",
          message: `Screenshot error: ${errorMessage}. This might be due to screen recording permissions. Please enable screen recording for Opus in System Settings → Privacy & Security → Screen Recording.`,
        });
        return;
      }

      let action = "";
      let hasToolCall = false;

      let response;
      try {
        response = await runActionAgent(
          appName,
          userPrompt,
          clickableElements,
          history,
          screenshotBase64,
          async (toolName: string, args: string) => {
            const actionResult = await performAction(
              `=${toolName}\n${args}`,
              bundleId,
              clickableElements,
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
                if (firstResult.type === "click") {
                  resultText = firstResult.error;
                } else {
                  resultText = `Error:\n${firstResult.error}`;
                }
              } else if (
                firstResult &&
                "stdout" in firstResult &&
                firstResult.stdout
              ) {
                resultText = `Success. Stdout:\n${firstResult.stdout}`;
              } else if (
                firstResult &&
                "type" in firstResult &&
                firstResult.type === "click" &&
                firstResult.element
              ) {
                const element = firstResult.element;
                resultText = `Successfully clicked element with ID ${firstResult.id}`;
                if (element.AXRole) resultText += `\nRole: ${element.AXRole}`;
                if (element.AXTitle)
                  resultText += `\nTitle: ${element.AXTitle}`;
                if (element.AXValue)
                  resultText += `\nValue: ${element.AXValue}`;
                if (element.AXHelp) resultText += `\nHelp: ${element.AXHelp}`;
                if (element.AXDescription)
                  resultText += `\nDescription: ${element.AXDescription}`;
                if (element.AXSubrole)
                  resultText += `\nSubrole: ${element.AXSubrole}`;
                if (element.AXRoleDescription)
                  resultText += `\nRole Description: ${element.AXRoleDescription}`;
                if (element.AXPlaceholderValue)
                  resultText += `\nPlaceholder: ${element.AXPlaceholderValue}`;
              } else if (
                firstResult &&
                "type" in firstResult &&
                firstResult.type === "key"
              ) {
                resultText = `Successfully pressed key: ${firstResult.keyString}`;
              } else if (
                firstResult &&
                "type" in firstResult &&
                firstResult.type === "applescript"
              ) {
                if (firstResult.error) {
                  resultText = `AppleScript error:\n${firstResult.error}`;
                } else {
                  resultText = `Successfully executed AppleScript`;
                  if (firstResult.stdout) {
                    resultText += `\nOutput: ${firstResult.stdout}`;
                  }
                }
              } else if (
                firstResult &&
                "type" in firstResult &&
                firstResult.type === "bash"
              ) {
                if (firstResult.error) {
                  resultText = `Bash error:\n${firstResult.error}`;
                } else {
                  resultText = `Successfully executed bash command`;
                  if (firstResult.stdout) {
                    resultText += `\nOutput: ${firstResult.stdout}`;
                  }
                }
              } else if (
                firstResult &&
                "type" in firstResult &&
                firstResult.type === "uri"
              ) {
                if (firstResult.error) {
                  resultText = `Error opening URI:\n${firstResult.error}`;
                } else {
                  resultText = `Successfully opened URI`;
                }
              } else {
                resultText = `Successfully executed action`;
              }
            } else {
              resultText = `Successfully executed action`;
            }

            return resultText;
          }
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logWithElapsed(
          "setupMainHandlers",
          `Error in runActionAgent: ${errorMessage}`
        );
        event.sender.send("reply", {
          type: "error",
          message: errorMessage,
        });
        return;
      }

      action = response;

      if (response.includes("=") && response.includes("\n")) {
        const lines = response.split("\n");
        for (const line of lines) {
          if (line.startsWith("=")) {
            hasToolCall = true;
            break;
          }
        }
      }

      if (shouldStop) {
        logWithElapsed("setupMainHandlers", "Operation stopped by user");
        event.sender.send("reply", {
          type: "error",
          message: "Operation stopped by user.",
        });
        return;
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

  process.on("exit", () => {
    if (accessibilityCheckInterval) {
      clearInterval(accessibilityCheckInterval);
    }
  });
}
