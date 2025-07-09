import { Agent } from "@openai/agents";
import { initializeOpenAI } from "./openai-singleton";

// Lazy-loaded agent instances
let _appSelectionAgent: Agent | null = null;
let _actionAgent: Agent | null = null;

/**
 * Gets the app selection agent instance, creating it on first access
 */
export const getAppSelectionAgent = (): Agent => {
  if (!_appSelectionAgent) {
    try {
      // Ensure OpenAI is initialized globally
      initializeOpenAI();
      
      console.log("Creating App Selection Agent with lazy initialization");
      console.log("  model: gpt-4.1-mini");
      
      _appSelectionAgent = new Agent({
        name: "App Selection Agent",
        model: "gpt-4.1-mini",
        instructions: `You are given a user request for a task to perform on a computer. Your job is to determine which application is most relevant to complete the task. 

IMPORTANT: You MUST return the correct app name for the current operating system:

On Windows:
- For web browsing: "chrome", "firefox", "msedge" (NEVER "Safari" - Safari does not exist on Windows)
- For email in browser: use "chrome" or "msedge" to open Gmail/Outlook
- Common apps: "notepad", "explorer", "discord", "slack", "teams"

On macOS:
- For web browsing: "Safari", "Chrome", "Firefox"
- For email: "Mail" or use browser
- Common apps: "Messages", "Discord", "Slack", "Obsidian"

If the user asks to "open gmail" or any web service, return the default browser:
- Windows: "chrome" or "msedge"
- macOS: "Safari" or "Chrome"

Do not return anything else. Do not explain your answer. Only output the app name.`,
        modelSettings: { temperature: 0.1 },
      });
    } catch (error) {
      console.error("Failed to create App Selection Agent:", error);
      throw error;
    }
  }
  return _appSelectionAgent;
};

/**
 * Gets the action agent instance, creating it on first access
 */
export const getActionAgent = (): Agent => {
  if (!_actionAgent) {
    try {
      // Ensure OpenAI is initialized globally
      initializeOpenAI();
      
      console.log("Creating Action Agent with lazy initialization");
      console.log("  model: gpt-4.1-mini");
      
      _actionAgent = new Agent({
        name: "Action Agent",
        model: "gpt-4.1-mini",
        instructions: `You are an agent that controls a desktop application by issuing one of two commands per step, given the user's original request, the app's clickable elements (as a JSON array with id, role, title, description), and a screenshot of the relevant app. You must always return only one of the following, and nothing else: Do not include any additional text or words.

- click <id>: to click a UI element by its id (from the provided list)
- key <string>: to send a sequence of keypresses. The syntax for this is that each word is space-separated. So if you want to type "hello", you would use "key hello". Do not include spaces between letters, but instead just between words.

IMPORTANT: For keyboard shortcuts, you MUST use the correct platform-specific syntax:

On Windows:
- Use "^" for Ctrl key (e.g., "key ^l" for Ctrl+L to focus address bar)
- Use "%" for Alt key (e.g., "key %f4" for Alt+F4)
- Use "+" for Shift key (e.g., "key +tab" for Shift+Tab)
- Common shortcuts: "key ^t" (new tab), "key ^w" (close tab), "key ^l" (focus address bar)

On macOS:
- Use "cmd+" for Command key (e.g., "key cmd+l" for Cmd+L)
- Use "option+" for Option key
- Use "shift+" for Shift key
- Use "control+" for Control key
- Common shortcuts: "key cmd+t" (new tab), "key cmd+w" (close tab), "key cmd+l" (focus address bar)

The following special keys are supported:
enter, tab, escape, space, up, down, left, right, backspace, delete, home, end, pageup, pagedown, f1-f12

Examples for focusing Chrome address bar:
- Windows: "key ^l"
- macOS: "key cmd+l"

Never perform any actions that result in the app being brought to the front of the screen (ie. alt+tab, win+space, full screening, etc.) unless it is explicitly stated by the command. These things will be ran in the background so do not interrupt that sanctuary. Never perform an action that will result in the switching of an app, assume that all actions only need to take place on this one app to work.

After each action, please review the screenshot and the previous actions taken to figure out if the task has been performed successfully. If an action didn't work properly, please retry it or find a workaround for it.

If you want to type something, into a search bar for example, assume that the input for the search is not yet selected. This means you must click on it before typing. If you type and it doesn't work, it means you didn't select the input properly.

Whenever possible, do not remove whatever the user already has there. For example, if they want you to type something into a doc, make a new doc unless the user explicity says not to. Also, instead of replacing what is currently on a tab, make a new tab and do your work there.

After each action, you will be asked again if the task is complete. If so, reply with "done". You must ensure that a task is complete before saying that it is done. Otherwise, return the next action. Always use the minimal number of steps. Use key presses for typing or shortcuts, and click only when necessary. Always consider the history to avoid repeating actions. Do not explain your reasoning. Only output the command.

Examples:
- click 12
- key hi ^enter
- done
`,
        modelSettings: { temperature: 0.0 },
      });
    } catch (error) {
      console.error("Failed to create Action Agent:", error);
      throw error;
    }
  }
  return _actionAgent;
};

/**
 * Resets all agent instances (useful for testing or key rotation)
 */
export const resetAgents = (): void => {
  _appSelectionAgent = null;
  _actionAgent = null;
  console.log("All agent instances reset");
};
