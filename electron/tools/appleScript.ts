import { exec } from "node:child_process";
import { TMPDIR } from "../main";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execPromise = promisify(exec);

export interface AppleScriptReturnType {
  type: "applescript";
  script: string;
  error: string;
}

export default async function runAppleScript(
  body: string,
): Promise<AppleScriptReturnType> {
  const filePath = path.join(TMPDIR, "script.scpt");
  fs.writeFileSync(filePath, body);
  const { stderr } = await execPromise(`osascript ${filePath}`);
  return {
    type: "applescript",
    script: body,
    error: stderr,
  };
}
