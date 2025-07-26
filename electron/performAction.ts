import runAppleScript from "./tools/appleScript";
import runBashScript from "./tools/bash";
import click from "./tools/click";
import key from "./tools/key";
import { openUri } from "./tools/uri";
import { ActionResult, Element } from "./types";
import { logWithElapsed } from "./utils/utils";

export async function performAction(
  action: string,
  bundleId: string,
  clickableElements: Element[],
  event: Electron.IpcMainEvent
): Promise<ActionResult | ActionResult[]> {
  logWithElapsed("performAction", `Performing action: ${action}`);

  // Split into commands: lines starting with =
  const commandRegex = /(^=\w+[ \n][^=]*)/gms;
  const matches = action.match(commandRegex);
  if (matches && matches.length > 1) {
    const results: ActionResult[] = [];
    for (const cmd of matches) {
      // Recursively call performAction for each command
      // Remove leading/trailing whitespace
      const res = await performAction(
        cmd.trim(),
        bundleId,
        clickableElements,
        event
      );
      if (Array.isArray(res)) results.push(...res);
      else results.push(res);
    }
    return results;
  }

  const match = action.match(/^(=\w+)[ \n]?(.*)$/s);
  const address = match ? match[1] : action;
  const body = match ? match[2] : "";

  switch (address) {
    case "=Applescript": {
      const res = await runAppleScript(body);
      if (res.error) {
        event.sender.send("reply", {
          type: "action",
          message: "Error when excecuting script: " + res.error,
        });
      } else {
        event.sender.send("reply", {
          type: "action",
          message: "Executed script",
        });
      }
      return res;
    }

    case "=URI": {
      const res = await openUri(body);
      event.sender.send("reply", {
        type: "action",
        message: `Opened URI ${body}`,
      });
      return res;
    }

    case "=Bash": {
      const res = await runBashScript(body);
      if (res.error) {
        event.sender.send("reply", {
          type: "action",
          message: "Error when excecuting script: " + res.error,
        });
      } else {
        event.sender.send("reply", {
          type: "action",
          message: "Executed script",
        });
      }
      return res;
    }

    case "=Key": {
      const res = await key(body, bundleId);
      event.sender.send("reply", {
        type: "action",
        message: `Sent key: ${res.keyString}`,
      });
      return res;
    }

    case "=Click": {
      const res = await click(body, clickableElements, bundleId);
      if (!res.error) {
        event.sender.send("reply", {
          type: "action",
          message:
            `Clicked element with id ${res.id}` +
            (res.element
              ? `${
                  res.element.AXRole !== "" && res.element.AXRole
                    ? ` (${res.element.AXRole})`
                    : ""
                }` +
                `${
                  res.element.AXTitle !== "" && res.element.AXTitle
                    ? ` (title: ${res.element.AXTitle})`
                    : ""
                }` +
                `${
                  res.element.AXValue !== "" && res.element.AXValue
                    ? ` (value: ${res.element.AXValue})`
                    : ""
                }` +
                `${
                  res.element.AXHelp !== "" && res.element.AXHelp
                    ? ` (help: ${res.element.AXHelp})`
                    : ""
                }` +
                `${
                  res.element.AXDescription !== "" && res.element.AXDescription
                    ? ` (desc: ${res.element.AXDescription})`
                    : ""
                }`
              : ""),
          id: res.id,
          element: res.element || null,
        });
      } else {
        event.sender.send("reply", {
          type: "action",
          message: `Error clicking element with id ${res.id}`,
          id: res.id,
          element: res.element || null,
        });
      }
      return res;
    }
    default:
      console.log("Unknown tool: " + address);
      return {
        type: "unknown tool",
      };
  }

  // } else if (action.startsWith("key ")) {
  //   const keyString = action.slice(4);
  //   await execPromise(`swift swift/key.swift ${bundleId} "${keyString}"`);
  //   logWithElapsed("performAction", `Executed key: ${keyString}`);
  //   event.sender.send("reply", {
  //     type: "action",
  //     message: `Sent key: ${keyString}`,
  //   });
  //   return { type: "key", keyString };
  // } else {
  //   logWithElapsed("performAction", `Unknown action: ${action}`);
  //   return { type: "unknown" };
  // }
}
