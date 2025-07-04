import empty from "./assets/empty.svg";
import { useState, useEffect, useRef } from "react";

const App = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState<string>("");
  const [messages, setMessages] = useState<{ type: string; message: string }[]>(
    []
  );
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
      }
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
    window.ipcRenderer.sendMessage(prompt);
    setShowPrompt(prompt);
    setPrompt("");
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-900">
      <form onSubmit={handleSubmit} className="flex p-2 bg-zinc-800">
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          className="flex-1 text-md p-4 rounded-lg border-none outline-none bg-zinc-900 text-white placeholder-zinc-400"
        />
        <button
          type="submit"
          disabled={prompt.length === 0}
          className="ml-4 text-md px-6 rounded-lg border-none bg-white text-zinc-900 font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {showPrompt && (
        <div className="px-4 py-2 bg-zinc-800 text-zinc-200 text-md font-mono border-b border-zinc-700">
          <span className="opacity-60 mr-2">Prompt:</span>
          {showPrompt}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 text-white text-md box-border">
        {messages.length === 0 ? (
          <div className="grid place-items-center h-full">
            <div>
              <img src={empty} alt="empty" className="w-1/3 mx-auto" />
              <p className="text-neutral-600 text-center mx-auto">
                Nothing yet
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-6 p-4 rounded-lg ${
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
  );
};

export default App;
