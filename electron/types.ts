import { AppleScriptReturnType } from "./tools/appleScript";
import { BashScriptReturnType } from "./tools/bash";
import { ClickReturnType } from "./tools/click";
import { KeyReturnType } from "./tools/key";
import { OpenUriReturnType } from "./tools/uri";

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
  | OpenUriReturnType
  | BashScriptReturnType
  | ClickReturnType
  | KeyReturnType
  | { type: "unknown tool" };
