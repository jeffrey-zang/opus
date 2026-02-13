import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const execPromise = promisify(exec);

let lastLogTime = Date.now();

function ensureLogDirectory() {
  const logDir = path.join(os.homedir(), "Library", "Logs", "Opus");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

export function logWithElapsed(functionName: string, message: string) {
  const now = Date.now();
  const elapsed = now - lastLogTime;
  lastLogTime = now;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${functionName}] [${elapsed}ms] ${message}`;

  console.log(`[${functionName}] [${elapsed}ms] ${message}`);

  try {
    const logDir = ensureLogDirectory();
    const logFile = path.join(logDir, "opus.log");
    fs.appendFileSync(logFile, logMessage + "\n", "utf8");
  } catch (error) {
    console.error("Failed to write to log file:", error);
  }
}
