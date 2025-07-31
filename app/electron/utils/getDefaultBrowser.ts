import { execPromise } from "./utils";

export default async function getDefaultBrowser() {
  const { stdout } = await execPromise(`swift swift/getDefaultBrowser.swift`);
  return stdout.trim();
}
