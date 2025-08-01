import OpenAI from "openai";
import { execPromise, logWithElapsed } from "./utils";
import getDefaultBrowser from "./getDefaultBrowser";
import * as fs from "node:fs";
import * as path from "node:path";
import getAllApps from "./getAllApps";

const openai = new OpenAI();

function saveAgentLog(
  logFolder: string,
  messages: any[],
  rawResponse: any,
  agentName: string
) {
  const timestamp = Date.now().toString();
  const logFilePath = path.join(logFolder, `${agentName}-${timestamp}.txt`);

  const logContent = `Agent: ${agentName}
Timestamp: ${new Date().toISOString()}

=== COMPLETE PROMPT ===
${JSON.stringify(messages, null, 2)}

=== RAW RESPONSE ===
${JSON.stringify(rawResponse, null, 2)}

=== EXTRACTED RESULT ===
${rawResponse.choices?.[0]?.message?.content || "No content"}`;

  try {
    fs.writeFileSync(logFilePath, logContent, "utf8");
    logWithElapsed("saveAgentLog", `Saved agent log to: ${logFilePath}`);
  } catch (error) {
    logWithElapsed("saveAgentLog", `Failed to save agent log: ${error}`);
  }
}

export async function getAppName(userPrompt: string, logFolder?: string) {
  logWithElapsed(
    "getAppName",
    `Start getAppName with userPrompt: ${userPrompt}`
  );

  try {
    const defaultBrowser = await getDefaultBrowser();
    const allApps = await getAllApps();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are given a user request for a task to perform on a Mac. Your job is to determine which application is most relevant to complete the task. Only return the name of the application, exactly as it appears in the macOS Applications folder or Dock (e.g., "Discord", "Safari", "Messages", "Obsidian"). Do not return anything else. Do not explain your answer. Only output the app name. The user's default browser is ${defaultBrowser}. The user's installed apps are ${allApps}.`,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: 0.0,
    });

    const appName = completion.choices[0]?.message?.content?.trim();

    if (logFolder) {
      saveAgentLog(logFolder, messages, completion, "getAppName");
    }

    logWithElapsed("getAppName", `Result: ${appName}`);
    return appName;
  } catch (error) {
    logWithElapsed("getAppName", `Error: ${error}`);
    if (logFolder) {
      const errorLog = {
        error: error,
        timestamp: new Date().toISOString(),
        userPrompt: userPrompt,
      };
      saveAgentLog(logFolder, [], errorLog, "getAppName");
    }
    return undefined;
  }
}

export async function getBundleId(appName: string) {
  logWithElapsed("getBundleId", `Getting bundle id for app: ${appName}`);
  const { stdout } = await execPromise(`osascript -e 'id of app "${appName}"'`);
  logWithElapsed("getBundleId", `Bundle id result: ${stdout.trim()}`);
  return stdout.trim();
}
