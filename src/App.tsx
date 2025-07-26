import empty from "./assets/empty.svg";
import { useState, useEffect, useRef } from "react";

const App = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState<string>("");
  const [messages, setMessages] = useState<{ type: string; message: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
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
      }
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessages([]);
    inputRef.current?.blur();
    window.ipcRenderer.sendMessage(prompt);
    setShowPrompt(prompt);
    setPrompt("");
    setLoading(true);
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
            className="flex p-2 bg-zinc-800 w-full app-region-no-drag"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="order sandblasters on amazon..."
              className="flex-1 text-md p-2 rounded-lg border-none outline-none bg-zinc-900 text-white placeholder-zinc-400 app-region-no-drag"
            />
            <button
              type="submit"
              disabled={prompt.length === 0}
              className="ml-4 text-md px-6 rounded-lg border-none bg-white text-zinc-900 font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 app-region-no-drag"
            >
              Send
            </button>
          </form>
        </div>
        {showPrompt && (
          <div
            className="px-4 py-2 bg-zinc-800 text-zinc-200 text-sm font-mono border-b border-zinc-700 app-region-no-drag"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {showPrompt}
          </div>
        )}
        <div
          className={`flex-1 ${
            messages.length !== 0 ? "px-4 pt-4" : ""
          } overflow-y-scroll text-white text-md box-border app-region-no-drag`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-pulse text-lg text-zinc-300">
                Reasoning...
              </div>
            </div>
          ) : (
            messages.length !== 0 &&
            messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 p-4 rounded-lg ${
                  msg.type === "error"
                    ? "bg-red-950"
                    : msg.type === "complete"
                    ? "bg-green-950"
                    : msg.type === "action"
                    ? "bg-blue-950"
                    : "bg-zinc-950"
                }`}
              >
                <div className="font-bold mb-2">
                  {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}
                </div>
                <div className="whitespace-pre-wrap text-sm text-neutral-200">
                  {msg.message}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
