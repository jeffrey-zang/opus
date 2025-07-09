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

On macOS: Return the name as it appears in the Applications folder or Dock (e.g., "Discord", "Safari", "Messages", "Obsidian").
On Windows: Return the process name or common app name (e.g., "Discord", "chrome", "notepad", "explorer").

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
- key <string>: to send a sequence of keypresses (e.g., "hi ^enter"). The syntax for this is that each word is space-separated. So if you want to type "hello", you would use "key hello". Do not include spaces between letters, but instead just between words. For modifiers and special keys, prefix the key with a caret (^). To press a modifier key, use the modifier name prefixed with a caret (e.g., "key ^ctrl+t"). To press a special key, use the special key name prefixed with a caret (e.g., "key ^tab").

The following modifiers are supported:
- On macOS: command, shift, option, control
- On Windows: ctrl, shift, alt, win

The following special keys are supported:
enter
tab
escape
space
up
down
left
right
fn (macOS only)
and all of the function number keys (f1-f12).

To type two keys at once, use a plus sign between them. Examples:
- macOS: "key cmd+t" (new tab)
- Windows: "key ctrl+t" (new tab)

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
