import { exec } from "node:child_process";
import { TMPDIR } from "../main";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execPromise = promisify(exec);

export default async function runAppleScript(body: string) {
  const filePath = path.join(TMPDIR, "script.scpt");
  fs.writeFileSync(filePath, body);
  return await execPromise(`osascript ${filePath}`);
}
