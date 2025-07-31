import OpenAI from "openai";
import { execPromise, logWithElapsed } from "./utils";

const openai = new OpenAI();

export async function getAppName(userPrompt: string) {
  logWithElapsed(
    "getAppName",
    `Start getAppName with userPrompt: ${userPrompt}`
  );

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are given a user request for a task to perform on a Mac. Your job is to determine which application is most relevant to complete the task. Only return the name of the application, exactly as it appears in the macOS Applications folder or Dock (e.g., "Discord", "Safari", "Messages", "Obsidian"). Do not return anything else. Do not explain your answer. Only output the app name.`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.0,
    });

    const appName = completion.choices[0]?.message?.content?.trim();
    logWithElapsed("getAppName", `Result: ${appName}`);
    return appName;
  } catch (error) {
    logWithElapsed("getAppName", `Error: ${error}`);
    return undefined;
  }
}

export async function getBundleId(appName: string) {
  logWithElapsed("getBundleId", `Getting bundle id for app: ${appName}`);
  const { stdout } = await execPromise(`osascript -e 'id of app "${appName}"'`);
  logWithElapsed("getBundleId", `Bundle id result: ${stdout.trim()}`);
  return stdout.trim();
}
