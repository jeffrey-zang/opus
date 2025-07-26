import { execPromise } from "./utils";
import path from "node:path";
import fs from "node:fs";

export default async function getApplescriptCommands(app: string) {
  const { stdout } = await execPromise(
    `osascript -e 'POSIX path of (path to application "${app}")'`
  );
  const appPath = stdout.trim();
  const resourcePath = path.join(appPath, "Contents/Resources/");
  const file = fs.readdirSync(resourcePath).find((x) => x.endsWith(".sdef"));
  if (!file) return "";
  return fs.readFileSync(path.join(resourcePath, file));
}
