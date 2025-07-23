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
  }
  try {
    await execPromise(`swift swift/click.swift ${bundleId} ${id}`);
    logWithElapsed("performAction", `Executed click for id: ${id}`);
    return { type: "click", id, element: element || null };
  } catch (error) {
    const { stderr } = error as ExecException;
    logWithElapsed("performAction", `Error clicking element ${id}: ${stderr}`);
    return { type: "click", id, element: element || null, error: stderr };
  }
}
