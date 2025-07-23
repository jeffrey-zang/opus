import { TMPDIR } from "../main";
import fs from "node:fs";
import path from "node:path";
import { execPromise } from "../utils/utils";
import { ExecException } from "node:child_process";

export interface AppleScriptReturnType {
  type: "applescript";
  script: string;
  stdout?: string;
  error: string;
}

export default async function runAppleScript(
  body: string
): Promise<AppleScriptReturnType> {
  const filePath = path.join(TMPDIR, "script.scpt");
  fs.writeFileSync(filePath, body);
  try {
    const { stdout } = await execPromise(`osascript ${filePath}`);
    return {
      type: "applescript",
      script: body,
      stdout,
      error: "",
    };
  } catch (error: unknown) {
    const { stderr } = error as ExecException;
    return {
      type: "applescript",
      script: body,
      error: stderr ?? "",
    };
  }
}
