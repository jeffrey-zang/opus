import { execPromise } from "./utils";
import { getSwiftPath } from "../main";
import * as path from "path";

export async function getAllApps(): Promise<string[]> {
  const { stdout } = await execPromise(
    `swift ${getSwiftPath("getAllApps.swift")}`,
    { cwd: path.dirname(getSwiftPath("getAllApps.swift")) }
  );
  return stdout.trim().split("\n").filter(Boolean);
}
