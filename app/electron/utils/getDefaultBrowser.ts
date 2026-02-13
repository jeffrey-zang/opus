import { execPromise } from "./utils";
import { getSwiftPath } from "../main";
import * as path from "path";

export async function getDefaultBrowser(): Promise<string> {
  const { stdout } = await execPromise(
    `swift ${getSwiftPath("getDefaultBrowser.swift")}`,
    { cwd: path.dirname(getSwiftPath("getDefaultBrowser.swift")) }
  );
  return stdout.trim();
}
