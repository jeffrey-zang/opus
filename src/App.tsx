import { useState, useEffect, useRef } from "react";

const App = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState<string>("");
  const [messages, setMessages] = useState<{ type: string; message: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [currentStream, setCurrentStream] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLInputElement>(null);

  useEffect(() => {
    window.ipcRenderer.on(
      "reply",
      (_, data: { type: string; message: string }) => {
        setMessages((prev) => {
          const exists = prev.some(
            (msg) => msg.type === data.type && msg.message === data.message
          );
          return exists ? prev : [...prev, data];
        });
        setLoading(false);
        setIsStreaming(false);
        setCurrentStream("");
      }
    );

    window.ipcRenderer.on(
      "stream",
      (_, data: { type: string; content?: string; toolName?: string }) => {
        setIsStreaming(true);
        setLoading(false);
        switch (data.type) {
          case "text":
            setCurrentStream((prev) => prev + data.content);
            break;
          case "tool_start":
            setCurrentStream((prev) => prev + `\n\n🔧 \`${data.toolName}\`\n`);
            break;
          case "tool_args":
            setCurrentStream((prev) => prev + data.content);
            break;
          case "tool_execute":
            setCurrentStream((prev) => prev + "\n⚡ *Executing...*");
            break;
          case "tool_result":
            setCurrentStream((prev) => prev + `\n✅ ${data.content}\n\n`);
            break;
          case "chunk_complete":
            // Keep streaming active, just a completion marker
            break;
        }
      }
    );

    return () => {
      window.ipcRenderer.removeAllListeners("reply");
      window.ipcRenderer.removeAllListeners("stream");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStream]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Reset state
    setMessages([]);
    setCurrentStream("");
    setLoading(false);
    setIsStreaming(true);

    // Send message and update UI
    inputRef.current?.blur();
    window.ipcRenderer.sendMessage(prompt);
    setShowPrompt(prompt);
    setPrompt("");
  };

  return (
    <div className="h-screen w-screen bg-zinc-900">
      <div className="flex flex-col h-full">
        <div
          className="app-region-drag w-full"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <form
            onSubmit={handleSubmit}
            className="flex p-3 bg-zinc-800 w-full app-region-no-drag"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="order sandblasters on amazon..."
              disabled={isStreaming}
              className="flex-1 text-md p-3 rounded-xl border border-zinc-700 outline-none bg-zinc-900/80 text-white placeholder-zinc-500 transition-all focus:border-zinc-600 focus:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed app-region-no-drag"
            />
            <button
              type="submit"
              disabled={prompt.length === 0 || isStreaming}
              className="ml-3 text-md px-4 py-3 rounded-xl border-none bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:from-zinc-700 disabled:to-zinc-700 transition-all hover:from-blue-500 hover:to-blue-400 app-region-no-drag"
            >
              {isStreaming ? "Thinking..." : "Send"}
            </button>
          </form>
        </div>
        {showPrompt && (
          <div
            className="px-6 py-2 bg-zinc-800/50 text-zinc-200 text-base border-b border-zinc-700/50 backdrop-blur-sm app-region-no-drag"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="font-medium text-zinc-300">Task:</span>
              <span className="text-zinc-100">{showPrompt}</span>
            </div>
          </div>
        )}
        <div
          className={`flex-1 ${
            messages.length !== 0 || isStreaming ? "px-4 pt-4" : ""
          } overflow-y-scroll text-white text-md box-border app-region-no-drag`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {loading && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-pulse text-lg text-zinc-300">
                Reasoning...
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-4 p-5 rounded-xl border backdrop-blur-sm ${
                    msg.type === "error"
                      ? "bg-red-950/30 border-red-800/50 text-red-100"
                      : msg.type === "complete"
                      ? "bg-green-950/30 border-green-800/50 text-green-100"
                      : msg.type === "action"
                      ? "bg-blue-950/30 border-blue-800/50 text-blue-100"
                      : "bg-zinc-800/30 border-zinc-700/50 text-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        msg.type === "error"
                          ? "bg-red-400"
                          : msg.type === "complete"
                          ? "bg-green-400"
                          : msg.type === "action"
                          ? "bg-blue-400"
                          : "bg-zinc-400"
                      }`}
                    ></div>
                    <span className="font-medium text-sm opacity-90">
                      {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-base leading-relaxed font-mono">
                    {msg.message}
                  </div>
                </div>
              ))}

              {(isStreaming || currentStream) && (
                <div className="mb-4 p-6 rounded-xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isStreaming
                            ? "bg-green-400 animate-pulse"
                            : "bg-zinc-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-zinc-300">
                        {isStreaming ? "Thinking..." : "Response"}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="whitespace-pre-wrap text-base text-zinc-100 leading-relaxed font-mono">
                      {currentStream}
                      {isStreaming && (
                        <span className="inline-block w-0.5 h-5 bg-green-400 ml-1 animate-pulse"></span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
