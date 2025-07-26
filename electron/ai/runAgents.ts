import { AgentInputItem } from "@openai/agents";
import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import { Element } from "../types";
import { logWithElapsed } from "../utils/utils";
import getApplescriptCommands from "../utils/getApplescriptCommands";

const openai = new OpenAI();

export async function* runActionAgentStreaming(
  appName: string,
  userPrompt: string,
  clickableElements: Element[],
  history: AgentInputItem[],
  screenshotBase64?: string,
  stepFolder?: string,
  onToolCall?: (toolName: string, args: any) => Promise<string>
) {
  logWithElapsed("runActionAgent", `Running action agent for app: ${appName}`);
  let parsedClickableElements = "";
  for (let i = 0; i < clickableElements.length; i++) {
    const element: Element = clickableElements[i];
    let roleOrSubrole = "";
    if (element.AXSubrole && element.AXSubrole !== "") {
      roleOrSubrole = element.AXSubrole + " ";
    } else if (element.AXRole && element.AXRole !== "") {
      roleOrSubrole = element.AXRole + " ";
    }
    parsedClickableElements +=
      `${element.id} ${roleOrSubrole}${
        element.AXTitle ? `${element.AXTitle.trim()} ` : ""
      }${element.AXValue ? `${element.AXValue.trim()} ` : ""}${
        element.AXHelp ? `${element.AXHelp.trim()} ` : ""
      }${element.AXDescription ? `${element.AXDescription.trim()} ` : ""}` +
      "\n";
  }

  const contentText =
    `You are operating on the app: ${appName}.\n\n` +
    `User prompt (the task you must complete): ${userPrompt}\n\n` +
    `Here is the sdef (Applescript command directory) file for the current app:\n${await getApplescriptCommands(
      appName
    )}\n\n` +
    `Here is a list of clickable elements:\n${parsedClickableElements}\n\n`;
  //+
  // `Action history so far:\n${
  //   parsedHistory
  //     ? parsedHistory
  //     : "No actions have been completed yet (this is the first action)."
  // }`;

  const agentInput: AgentInputItem[] = [
    { role: "user", content: [{ type: "input_text", text: userPrompt }] },
    ...history,
    {
      role: "user",
      content: [
        { type: "input_text" as const, text: contentText },
        ...(screenshotBase64
          ? [
              {
                type: "input_image" as const,
                image: `data:image/png;base64,${screenshotBase64}`,
              },
            ]
          : []),
      ],
    },
  ];

  if (stepFolder) {
    fs.writeFileSync(path.join(stepFolder, "agent-prompt.txt"), contentText);
    fs.writeFileSync(
      path.join(stepFolder, "fullPrompt.json"),
      JSON.stringify(agentInput)
    );
    logWithElapsed("runActionAgent", `Saved agent-prompt.txt`);
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an agent that generates an instruction to be executed. Generate the next step to accomplish the following task from the current position, indicated by the screenshot. Use the previous steps taken to inform your next action. If a previous step failed, you will see the error message and the script that caused it. Analyze the error and the script, and generate a new step to recover and continue the task. However, if you see that a strategy is failing repeatedly, you must backtrack and try a completely different solution. Don't get stuck in a loop. Do not add any extra fluff. Only give the instruction and nothing else. You are not talking to a human. You will eventually run these tasks. Just give me the frickin instruction man. You are making this instruction for a MacBook. Do not add anything before or after the instruction. Do not be creative. Do not add unnecessary things. If there are no previous steps, then you are generating the first step to be executed. Make each step as short concise, and simple as possible.

Do not delete a user's work. For example, open a new tab in a browser, instead of overriding the user's current one. Open a new Google doc instead of using an existing one.

You may notice that you are given a lot of context for lower priority tools. For example, a list of UI elements for the Click tool. You **may ignore** these completely, if a higher priority tool can perform an action equally well or better. The amount of context given for the lower priority tools are simply due to their nature. It does not mean you should prioritize them more. You will receive this context regardless of whether it is useful for the task. It is up to you to filter it, if needed. For example, if you want to open a new tab in a browser, the Applescript tool is preferred, over using the Key and Click.

If the screenshot, along with previous commands run, indicate that the task has been completed successfully, simply reply with a very short message (a few words) stating that the task has been finished, appending the word STOP in all caps at the end. For example: "You are already registered STOP". Be sure that this ending message is aware of the starting one (ie. if the starting request is "Open Safari", have it be "Safari is opened! STOP").

Below are the tools you have access to. They are roughly in the order you should prioritize them, however, use the right tool for the job. If multiple tools can accomplish the same task, use the tool that comes first in the list. It is more reliable. That being said, use the best matching tool first. Don't try to use Applescript to handle key events, for example. Use the Key tool instead. If you have tried to use the same tool many times, and it doesn't work, switch tools. If it takes fewer steps to use any tool, use that one. To use a tool, simply start the first line with \`=toolname\`, then a new line with whatever the tool expects.

Always be sure to prefix your response equal sign and the tool that is being used. (ie. =Click, =Key, =Applescript)

There is an additional requirement to ensure that any action you take does not change the focus of the user. Your actions must work completely in the background. The URI, key, and click tools do this by default, but for the other tools, ensure it does not take away the user's focus. When picking a tool to complete a task, prioritize them in the order below.

# Tools

## Applescript
Run an Applescript (.scpt) script on the user's computer. Use this to tell supported apps to do things. For example, to tell Spotify to play. Do not use this as a replacement for other tools. For example, do not use this tool to perform key presses.
Expects a valid Applescript script in plaintext, not in a codeblock.
Returns the result of running the script, either success or error.
Start your response with =Applescript to use this tool.

## URI
Open a URI for an app that supports it. For example, an obsidian://... URI. Use this on apps that have a URI.
Expects a valid URI.
Returns the result of opening the URI, either success or error.
Start your response with =URI to use this tool.

## Bash
Run a Bash (.sh) script on the user's computer. Very useful if the app has a powerful CLI (eg. VSCode). You may use this for any other bash script, however. Do not use this as a replacement for other tools. For example, do not use this tool to perform key presses.
Expects a valid bash script, in plaintext, not a codeblock.
Returns the result of running the script, either success or error.
Start your response with =Bash to use this tool.

## Key
Type into an application using the keyboard. Use this for typing text, or typing keyboard shortcuts. You may use modifier keys and special keys. If the application has keyboard shortcuts to perform an action, prefer using this instead of clicking UI elements.
Expects the string to be typed into the application
You may use modifier keys and special keys. To use them, you must first separate it from the other text with a space (\` \`), you must escape them with a carat (\`^\`). To type multiple keys at once, separate them with a plus (\`+\`). For example, "^cmd+t", or "foo ^enter". Do not put a space between your characters in one word. Another example "foo bar ^enter". Here is a list of all available modifiers and special keys:

The following modifiers are supported:
command
shift
option
control

The following special keys are supported:
enter
tab
escape
space
up
down
left
right
fn
and all of the function number keys (f1-f12).

Start your response with =Key to use this tool.

## Click
Click a UI Element. You may be given a list of UI Elements. If one of these elements suits the use case, click on it. Only use this if the element is in the list given. Do not attempt to click an element which is not on the list.
Expects a number, that is the element ID. This is at the start of each element entry. This must be a number, and not the description of the element. Do NOT give the description or title of the element. Only give the numerical ID.

Start your response with =Click to use this tool.`
    }
  ];

  // Convert agent input to OpenAI messages format
  for (const item of agentInput) {
    if ("role" in item) {
      if (item.role === "user") {
        if (Array.isArray(item.content)) {
          const textContent = item.content.find((c: any) => c.type === "input_text")?.text || "";
          const imageContent = item.content.find((c: any) => c.type === "input_image");
          
          if (imageContent) {
            messages.push({
              role: "user",
              content: [
                { type: "text", text: textContent },
                { type: "image_url", image_url: { url: (imageContent as any).image } }
              ]
            });
          } else {
            messages.push({ role: "user", content: textContent });
          }
        } else {
          messages.push({ role: "user", content: item.content as string });
        }
      } else if (item.role === "assistant") {
        if (Array.isArray(item.content)) {
          const textItem = item.content.find((c: any) => c.type === "output_text");
          const text = textItem ? (textItem as any).text : "";
          messages.push({ role: "assistant", content: text });
        } else {
          messages.push({ role: "assistant", content: item.content as string });
        }
      } else if (item.role === "system") {
        messages.push({ role: "system", content: item.content as string });
      }
    }
  }

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    stream: true,
    temperature: 0.0
  });

  let accumulatedText = "";
  let isToolCall = false;
  let toolName = "";
  let toolArgs = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta?.content) continue;

    const content = delta.content;
    
    // Check for tool call pattern before adding to accumulated text
    const tempAccumulated = accumulatedText + content;
    if (tempAccumulated.includes("=") && !isToolCall) {
      const toolMatch = tempAccumulated.match(/=([A-Za-z]+)/);
      if (toolMatch) {
        // Send any text before the tool call
        const beforeTool = tempAccumulated.substring(0, toolMatch.index);
        const remainingText = beforeTool.substring(accumulatedText.length);
        if (remainingText) {
          yield { type: "text", content: remainingText };
        }
        
        isToolCall = true;
        toolName = toolMatch[1];
        yield { type: "tool_start", toolName };
        
        // Initialize tool args with any content after the tool name
        toolArgs = tempAccumulated.substring(toolMatch.index! + toolMatch[0].length);
        if (toolArgs) {
          yield { type: "tool_args", content: toolArgs };
        }
        accumulatedText = beforeTool;
        continue;
      }
    }

    accumulatedText += content;
    
    if (isToolCall) {
      if (!toolArgs.includes(content)) {
        toolArgs += content;
        yield { type: "tool_args", content };
      }
    } else {
      // Stream each character individually for smooth display
      yield { type: "text", content };
    }
  }

  // Execute tool if we have one
  if (isToolCall && onToolCall) {
    yield { type: "tool_execute", toolName };
    const result = await onToolCall(toolName, toolArgs.trim());
    yield { type: "tool_result", content: result };
    
    // Return the full accumulated text plus tool info for history
    const fullResponse = accumulatedText.trim() + `\n=${toolName}\n${toolArgs.trim()}`;
    return fullResponse;
  }

  return accumulatedText.trim();
}
