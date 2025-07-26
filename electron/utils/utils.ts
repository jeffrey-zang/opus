import { exec } from "node:child_process";
import { promisify } from "node:util";
export const execPromise = promisify(exec);

let lastLogTime = Date.now();
export function logWithElapsed(functionName: string, message: string) {
  const now = Date.now();
  const elapsed = now - lastLogTime;
  lastLogTime = now;
  console.log(`[${functionName}] [${elapsed}ms] ${message}`);
}
