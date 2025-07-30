import { AgentInputItem } from "@openai/agents";
import OpenAI from "openai";
import * as fs from "node:fs";
import * as path from "node:path";
import { Element } from "../types";
import { logWithElapsed } from "../utils/utils";
import getApplescriptCommands from "../utils/getApplescriptCommands";

const openai = new OpenAI();

export interface ContinuousStreamChunk {
  type:
    | "text"
    | "tool_start"
    | "tool_args"
    | "tool_execute"
    | "tool_result"
    | "thinking"
    | "complete";
  content?: string;
  toolName?: string;
  toolArgs?: string;
}

export async function* runContinuousAgent(
  appName: string,
  userPrompt: string,
  clickableElements: Element[],
  conversationHistory: AgentInputItem[],
  screenshotBase64?: string,
  stepFolder?: string,
  onToolCall?: (toolName: string, args: string) => Promise<string>
): AsyncGenerator<ContinuousStreamChunk, void, unknown> {
  logWithElapsed(
    "runContinuousAgent",
    `Running continuous agent for app: ${appName}`
  );

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

  const systemPrompt = `You are an AI assistant that helps users accomplish tasks on their Mac. You can think, reason, and use tools to complete tasks. You should be conversational and helpful, explaining what you're doing as you work.

You are currently operating on the app: ${appName}.

You have access to several tools to help you complete tasks. When you need to use a tool, format your response like this:
=ToolName
tool arguments here

After using a tool, you'll receive the result and can continue the conversation. You can use multiple tools in sequence if needed.

If the task is complete, simply say so naturally in your response.

Available tools:
- Applescript: Run AppleScript commands
- URI: Open URIs for apps that support them  
- Bash: Run bash scripts
- Key: Type text or keyboard shortcuts
- Click: Click UI elements

Always be helpful and conversational. Explain your reasoning and what you're doing.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  // Convert conversation history to OpenAI format
  for (const item of conversationHistory) {
    if ("role" in item) {
      if (item.role === "user") {
        if (Array.isArray(item.content)) {
          const textContentItem = item.content.find(
            (c: any) => c.type === "input_text"
          );
          const textContent =
            textContentItem && "text" in textContentItem
              ? textContentItem.text
              : "";
          const imageContent = item.content.find(
            (c: any) => c.type === "input_image"
          );

          if (imageContent) {
            messages.push({
              role: "user",
              content: [
                { type: "text" as const, text: textContent },
                {
                  type: "image_url" as const,
                  image_url: { url: (imageContent as any).image },
                },
              ],
            });
          } else {
            messages.push({ role: "user", content: textContent });
          }
        } else {
          messages.push({ role: "user", content: item.content as string });
        }
      } else if (item.role === "assistant") {
        if (Array.isArray(item.content)) {
          const textItem = item.content.find(
            (c: any) => c.type === "output_text"
          );
          const text = textItem ? (textItem as any).text : "";
          messages.push({ role: "assistant", content: text });
        } else {
          messages.push({ role: "assistant", content: item.content as string });
        }
      }
    }
  }

  // Add current context
  const contextText =
    `Current app: ${appName}\n\n` +
    `Available AppleScript commands:\n${await getApplescriptCommands(
      appName
    )}\n\n` +
    `Clickable UI elements:\n${parsedClickableElements}\n\n` +
    `User request: ${userPrompt}`;

  messages.push({
    role: "user",
    content: [
      { type: "text" as const, text: contextText },
      ...(screenshotBase64
        ? [
            {
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${screenshotBase64}` },
            },
          ]
        : []),
    ],
  });

  if (stepFolder) {
    fs.writeFileSync(
      path.join(stepFolder, "continuous-agent-prompt.txt"),
      contextText
    );
    fs.writeFileSync(
      path.join(stepFolder, "continuous-fullPrompt.json"),
      JSON.stringify(messages)
    );
  }

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    stream: true,
    temperature: 0.7,
  });

  let accumulatedText = "";
  let isToolCall = false;
  let toolName = "";
  let toolArgs = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta?.content) continue;

    const content = delta.content;

    // Check for tool call pattern
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
        toolArgs = tempAccumulated.substring(
          toolMatch.index! + toolMatch[0].length
        );
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
      yield { type: "text", content };
    }
  }

  // Execute tool if we have one
  if (isToolCall && onToolCall) {
    yield { type: "tool_execute", toolName };
    const result = await onToolCall(toolName, toolArgs.trim());
    yield { type: "tool_result", content: result };

    // Continue the conversation with the tool result
    const fullResponse =
      accumulatedText.trim() + `\n=${toolName}\n${toolArgs.trim()}`;

    // Add the assistant's response to history
    conversationHistory.push({
      role: "assistant",
      content: [{ type: "output_text", text: fullResponse }],
      status: "completed",
    });

    // Add the tool result as a user message
    conversationHistory.push({
      role: "user",
      content: [{ type: "input_text", text: `Tool result: ${result}` }],
    });

    // Continue the conversation
    yield* runContinuousAgent(
      appName,
      userPrompt,
      clickableElements,
      conversationHistory,
      screenshotBase64,
      stepFolder,
      onToolCall
    );
  } else {
    // No tool call, just return the text response
    const response = accumulatedText.trim();
    if (response) {
      conversationHistory.push({
        role: "assistant",
        content: [{ type: "output_text", text: response }],
        status: "completed",
      });
    }

    yield { type: "complete" };
  }
}
