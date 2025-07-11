import { AppleScriptReturnType } from "./tools/appleScript";
import { ClickReturnType } from "./tools/click";

export interface Window {
  pid: string;
  name: string;
  app: string;
}

export interface Element {
  id: number;
  AXRole?: string;
  AXTitle?: string;
  AXHelp?: string;
  AXValue?: string;
  AXURL?: string;
  AXDescription?: string;
  AXSubrole?: string;
}

export type ActionResult =
  | AppleScriptReturnType
  | ClickReturnType
  | { type: "unknown tool" };
