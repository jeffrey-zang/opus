import OpenAI from "openai";
import { Element } from "../types";
import { logWithElapsed } from "../utils/utils";
import getApplescriptCommands from "../utils/getApplescriptCommands";

const openai = new OpenAI();

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ToolCall {
  toolName: string;
  args: string;
  result?: string;
  timestamp: number;
}

export interface ConversationState {
  messages: ConversationMessage[];
  toolCalls: ToolCall[];
  currentApp?: string;
  clickableElements: Element[];
  screenshotBase64?: string;
}

export async function* runConversationalAgent(
  userPrompt: string,
  state: ConversationState,
  onToolCall?: (toolName: string, args: string) => Promise<string>
): AsyncGenerator<{
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
}> {
  logWithElapsed(
    "runConversationalAgent",
    `Processing user prompt: ${userPrompt}`
  );

  // Add user message to conversation
  state.messages.push({
    role: "user",
    content: userPrompt,
    timestamp: Date.now(),
  });

  // Build context for the AI
  const context = buildContext(state);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are Opus, a helpful AI assistant that can perform actions on your Mac. You have access to various tools to help you complete tasks.

You should be conversational and helpful. When a user asks you to do something, you can:
1. Talk to them naturally about what you're going to do
2. Use tools to perform actions
3. Explain what you're doing and why
4. Ask for clarification if needed

You have access to these tools (use them by starting your response with =toolname):

## Applescript
Run AppleScript commands. Use for app automation.
Format: =Applescript
tell application "Safari"
    activate
end tell

## URI
Open URIs for apps that support them.
Format: =URI
obsidian://open?vault=MyVault

## Bash
Run bash commands.
Format: =Bash
ls -la

## Key
Send keyboard input and shortcuts.
Format: =Key
Hello world ^enter

## Click
Click UI elements by ID.
Format: =Click
42

Be conversational, helpful, and explain your actions. If you need to use a tool, start that part of your response with the tool name prefixed with =.

Current context: ${context}`,
    },
    ...state.messages.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    })),
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    stream: true,
    temperature: 0.7,
  });

  let accumulatedText = "";
  let isToolCall = false;
  let toolName = "";
  let toolArgs = "";
  let toolCallStartIndex = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta?.content) continue;

    const content = delta.content;
    const tempAccumulated = accumulatedText + content;

    // Check for tool call pattern
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
        toolCallStartIndex = tempAccumulated.length;
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

    // Add tool call to state
    state.toolCalls.push({
      toolName,
      args: toolArgs.trim(),
      result,
      timestamp: Date.now(),
    });

    // Add assistant message with tool call
    const fullResponse =
      accumulatedText.trim() + `\n=${toolName}\n${toolArgs.trim()}`;
    state.messages.push({
      role: "assistant",
      content: fullResponse,
      timestamp: Date.now(),
    });

    return;
  }

  // Add assistant message
  state.messages.push({
    role: "assistant",
    content: accumulatedText.trim(),
    timestamp: Date.now(),
  });
}

function buildContext(state: ConversationState): string {
  let context = "";

  if (state.currentApp) {
    context += `Current app: ${state.currentApp}\n`;
  }

  if (state.clickableElements.length > 0) {
    context += `Available UI elements: ${state.clickableElements.length} elements\n`;
  }

  if (state.toolCalls.length > 0) {
    context += `Recent tool calls: ${state.toolCalls.length} calls\n`;
  }

  return context;
}

export function createInitialState(): ConversationState {
  return {
    messages: [],
    toolCalls: [],
    clickableElements: [],
  };
}
