import { execPromise } from "./utils";

export default async function getAllApps() {
  const { stdout } = await execPromise(`swift swift/getAllApps.swift`);
  return stdout.trim();
}
