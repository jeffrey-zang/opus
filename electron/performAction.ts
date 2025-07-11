import runAppleScript from "./tools/appleScript";
import { Element } from "./types";
import { logWithElapsed, execPromise } from "./utils";

export async function performAction(
  action: string,
  bundleId: string,
  clickableElements: unknown[],
  event: Electron.IpcMainEvent,
) {
  logWithElapsed("performAction", `Performing action: ${action}`);
  const address = action.slice(0, action.indexOf("\n"));
  const body = action.slice(action.indexOf("\n"));
  switch (address) {
    case "=Applescript": {
      const { stderr } = await runAppleScript(body);
      if (stderr) {
        event.sender.send("reply", {
          type: "action",
          message: "Error when excecuting script: " + stderr,
        });
        return {
          type: "applescript",
          script: body,
          error: stderr,
        };
      } else {
        event.sender.send("reply", {
          type: "action",
          message: "Executed script",
        });
        return {
          type: "applescript",
          script: body,
        };
      }
    }
    default:
      console.log("Unknown tool: " + address);
      break;
  }
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
        `Clicked element info: ${JSON.stringify(element)}`,
      );
    }
    await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
    logWithElapsed("performAction", `Executed click for id: ${id}`);
    event.sender.send("reply", {
      type: "action",
      message:
        `Clicked element with id ${id}` +
        (element
          ? `${
              element.AXRole !== "" && element.AXRole
                ? ` (${element.AXRole})`
                : ""
            }` +
            `${
              element.AXTitle !== "" && element.AXTitle
                ? ` (title: ${element.AXTitle})`
                : ""
            }` +
            `${
              element.AXValue !== "" && element.AXValue
                ? ` (value: ${element.AXValue})`
                : ""
            }` +
            `${
              element.AXHelp !== "" && element.AXHelp
                ? ` (help: ${element.AXHelp})`
                : ""
            }` +
            `${
              element.AXDescription !== "" && element.AXDescription
                ? ` (desc: ${element.AXDescription})`
                : ""
            }`
          : ""),
      id,
      element: element || null,
    });
    return { type: "click", id, element: element || null };
  } else if (action.startsWith("key ")) {
    const keyString = action.slice(4);
    await execPromise(`swift swift/key.swift ${bundleId} "${keyString}"`);
    logWithElapsed("performAction", `Executed key: ${keyString}`);
    event.sender.send("reply", {
      type: "action",
      message: `Sent key: ${keyString}`,
    });
    return { type: "key", keyString };
  } else {
    logWithElapsed("performAction", `Unknown action: ${action}`);
    return { type: "unknown" };
  }
}
