import OpenAI from "openai";
import { execPromise, logWithElapsed } from "./utils";
import { getDefaultBrowser } from "./getDefaultBrowser";
import { getAllApps } from "./getAllApps";

const openai = new OpenAI();
});

export async function getAppName(userPrompt: string) {
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

export async function getAppInfo() {
  const [defaultBrowser, allApps] = await Promise.all([
    getDefaultBrowser(),
    getAllApps(),
  ]);

  return {
    defaultBrowser,
    allApps,
  };
}
