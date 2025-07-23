import { execPromise, logWithElapsed } from "../utils/utils";

export interface KeyReturnType {
  type: "key";
  keyString: string;
}
export default async function key(
  body: string,
  bundleId: string
): Promise<KeyReturnType> {
  const keyString = body;
  await execPromise(`swift swift/key.swift ${bundleId} "${keyString}"`);
  logWithElapsed("performAction", `Executed key: ${keyString}`);
  return { type: "key", keyString };
}
