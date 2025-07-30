import { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  toolName: string;
  args: string;
  result?: string;
  timestamp: number;
}

interface StreamChunk {
  type: "text" | "tool_start" | "tool_args" | "tool_execute" | "tool_result";
  content?: string;
  toolName?: string;
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [currentApp, setCurrentApp] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Handle streaming responses
    window.ipcRenderer.on("stream", (_, data: StreamChunk) => {
      setIsStreaming(true);

      switch (data.type) {
        case "text":
          setCurrentMessage((prev) => prev + (data.content || ""));
          break;
        case "tool_start":
          setCurrentToolCall({
            toolName: data.toolName || "",
            args: "",
            timestamp: Date.now(),
          });
          break;
        case "tool_args":
          setCurrentToolCall((prev) =>
            prev ? { ...prev, args: prev.args + (data.content || "") } : null
          );
          break;
        case "tool_execute":
          setCurrentToolCall((prev) =>
            prev ? { ...prev, result: "Executing..." } : null
          );
          break;
        case "tool_result":
          setCurrentToolCall((prev) =>
            prev ? { ...prev, result: data.content || "Completed" } : null
          );
          break;
      }
    });

    // Handle completed responses
    window.ipcRenderer.on(
      "reply",
      (_, data: { type: string; message: string }) => {
        setIsStreaming(false);

        if (data.type === "complete") {
          // Add the current message to the conversation
          if (currentMessage.trim()) {
            const newMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: currentMessage,
              timestamp: Date.now(),
              toolCalls: currentToolCall ? [currentToolCall] : undefined,
            };

            setMessages((prev) => [...prev, newMessage]);
            setCurrentMessage("");
            setCurrentToolCall(null);
          }
        } else if (data.type === "error") {
          // Add error message
          const errorMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: `❌ ${data.message}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setCurrentMessage("");
          setCurrentToolCall(null);
        }
      }
    );

    // Handle app changes
    window.ipcRenderer.onAppChanged((data: { appName: string }) => {
      setCurrentApp(data.appName);
    });

    return () => {
      window.ipcRenderer.removeAllListeners("stream");
      window.ipcRenderer.removeAllListeners("reply");
      window.ipcRenderer.removeAllListeners("app-changed");
    };
  }, [currentMessage, currentToolCall]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentMessage, currentToolCall]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Send to main process
    window.ipcRenderer.sendMessage(inputValue);

    // Focus input for next message
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentMessage("");
    setCurrentToolCall(null);
    setCurrentApp("");
    window.ipcRenderer.resetConversation();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderToolCall = (toolCall: ToolCall) => (
    <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
        <span className="text-sm font-medium text-blue-300">
          {toolCall.toolName}
        </span>
      </div>
      <div className="text-sm text-blue-200 font-mono mb-2">
        {toolCall.args}
      </div>
      {toolCall.result && (
        <div className="text-sm text-green-200">✅ {toolCall.result}</div>
      )}
    </div>
  );

  return (
    <div className="h-screen w-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div>
            <h1 className="text-white font-semibold">Opus</h1>
            {currentApp && (
              <p className="text-xs text-zinc-400">Active: {currentApp}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-white font-bold text-2xl">O</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Welcome to Opus
            </h2>
            <p className="text-zinc-400 max-w-md">
              I'm your AI assistant that can help you with tasks on your Mac.
              Just tell me what you'd like to do!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">O</span>
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.toolCalls?.map((toolCall, index) => (
                <div key={index}>{renderToolCall(toolCall)}</div>
              ))}
              <div className="text-xs opacity-60 mt-2">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">U</span>
              </div>
            )}
          </div>
        ))}

        {/* Current streaming message */}
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">O</span>
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-800 text-zinc-100">
              <div className="whitespace-pre-wrap">
                {currentMessage}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-blue-400 ml-1 animate-pulse"></span>
                )}
              </div>
              {currentToolCall && renderToolCall(currentToolCall)}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What would you like me to help you with?"
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-800 text-white placeholder-zinc-400 px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium rounded-xl hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isStreaming ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Thinking...
              </>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
