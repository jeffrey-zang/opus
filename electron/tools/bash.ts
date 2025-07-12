import { TMPDIR } from "../main";
import fs from "node:fs";
import path from "node:path";
import { execPromise } from "../utils";

export interface BashScriptReturnType {
  type: "bash";
  script: string;
  error: string;
}

export default async function runBashScript(
  body: string,
): Promise<BashScriptReturnType> {
  const filePath = path.join(TMPDIR, "script.sh");
  fs.writeFileSync(filePath, body);
  const { stderr } = await execPromise(`bash ${filePath}`);
  return {
    type: "bash",
    script: body,
    error: stderr,
  };
}
