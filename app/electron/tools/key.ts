import { execPromise } from "../utils/utils";
import { getSwiftPath } from "../main";
import * as path from "path";

export interface KeyReturnType {
  type: "key";
  keyString: string;
}

export async function key(bundleId: string, keyString: string): Promise<void> {
  await execPromise(
    `swift ${getSwiftPath("key.swift")} ${bundleId} "${keyString}"`,
    { cwd: path.dirname(getSwiftPath("key.swift")) }
  );
}

export default async function keyAction(
  body: string,
  bundleId: string
): Promise<KeyReturnType> {
  const keyString = body;
  await key(bundleId, keyString);
  return { type: "key", keyString };
}
