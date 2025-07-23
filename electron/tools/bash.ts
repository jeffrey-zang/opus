import { TMPDIR } from "../main";
import fs from "node:fs";
import path from "node:path";
import { execPromise } from "../utils/utils";
import { ExecException } from "node:child_process";

export interface BashScriptReturnType {
  type: "bash";
  script: string;
  stdout?: string;
  error: string;
}

export default async function runBashScript(
  body: string
): Promise<BashScriptReturnType> {
  const filePath = path.join(TMPDIR, "script.sh");
  fs.writeFileSync(filePath, body);
  try {
    const { stdout } = await execPromise(`bash ${filePath}`);
    return {
      type: "bash",
      script: body,
      stdout,
      error: "",
    };
  } catch (error: unknown) {
    const { stderr } = error as ExecException;
    return {
      type: "bash",
      script: body,
      error: stderr ?? "",
    };
  }
}
