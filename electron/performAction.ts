import runAppleScript from "./tools/appleScript";
import click from "./tools/click";
import { ActionResult, Element } from "./types";
import { logWithElapsed } from "./utils";

export async function performAction(
  action: string,
  bundleId: string,
  clickableElements: Element[],
  event: Electron.IpcMainEvent,
): Promise<ActionResult> {
  logWithElapsed("performAction", `Performing action: ${action}`);
  const address = action.slice(0, action.indexOf("\n"));
  const body = action.slice(action.indexOf("\n") + 1);
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
    case "=UIElementClick": {
      const res = await click(body, clickableElements, bundleId);
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
      return res;
    }
    default:
      console.log("Unknown tool: " + address);
      return {
        type: "unknown tool",
      };
  }

  // if (action.startsWith("click ")) {
  //   const id = action.split(" ")[1];
  //   const element = (clickableElements as Element[]).find((el) => {
  //     if (typeof el === "object" && el !== null) {
  //       const rec = el as unknown as Record<string, unknown>;
  //       return String(rec.id) === id || String(rec.elementId) === id;
  //     }
  //     return false;
  //   });
  //   if (element) {
  //     logWithElapsed(
  //       "performAction",
  //       `Clicked element info: ${JSON.stringify(element)}`,
  //     );
  //   }
  //   await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
  //   logWithElapsed("performAction", `Executed click for id: ${id}`);
  //   event.sender.send("reply", {
  //     type: "action",
  //     message:
  //       `Clicked element with id ${id}` +
  //       (element
  //         ? `${
  //             element.AXRole !== "" && element.AXRole
  //               ? ` (${element.AXRole})`
  //               : ""
  //           }` +
  //           `${
  //             element.AXTitle !== "" && element.AXTitle
  //               ? ` (title: ${element.AXTitle})`
  //               : ""
  //           }` +
  //           `${
  //             element.AXValue !== "" && element.AXValue
  //               ? ` (value: ${element.AXValue})`
  //               : ""
  //           }` +
  //           `${
  //             element.AXHelp !== "" && element.AXHelp
  //               ? ` (help: ${element.AXHelp})`
  //               : ""
  //           }` +
  //           `${
  //             element.AXDescription !== "" && element.AXDescription
  //               ? ` (desc: ${element.AXDescription})`
  //               : ""
  //           }`
  //         : ""),
  //     id,
  //     element: element || null,
  //   });
  //   return { type: "click", id, element: element || null };
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
