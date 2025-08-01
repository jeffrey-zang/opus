import { ExecException } from "node:child_process";
import { Element } from "../types";
import { logWithElapsed, execPromise } from "../utils/utils";

export interface ClickReturnType {
  type: "click";
  id: string;
  error?: string;
  element: Element | null;
}

export default async function click(
  body: string,
  clickableElements: Element[],
  bundleId: string
): Promise<ClickReturnType> {
  const id = body;
  const element = clickableElements.find((el) => {
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
  } else {
    logWithElapsed(
      "performAction",
      `Warning: Could not find element with id ${id} in clickable elements list`
    );
  }
  try {
    await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
    logWithElapsed("performAction", `Executed click for id: ${id}`);
    return { type: "click", id, element: element || null };
  } catch (error) {
    const { stderr } = error as ExecException;
    logWithElapsed("performAction", `Error clicking element ${id}: ${stderr}`);
    const errorMessage = element
      ? `Failed to click element with ID ${id} (${
          element.AXRole || "unknown role"
        }${element.AXTitle ? `: ${element.AXTitle}` : ""}${
          element.AXRoleDescription ? ` (${element.AXRoleDescription})` : ""
        }${
          element.AXPlaceholderValue ? ` [${element.AXPlaceholderValue}]` : ""
        }): ${stderr}`
      : `Failed to click element with ID ${id} (element not found): ${stderr}`;
    return { type: "click", id, element: element || null, error: errorMessage };
  }
}
