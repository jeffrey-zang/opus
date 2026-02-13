import { useState, useEffect, useRef } from "react";
import {
  // IconBrandSafari,
  IconBulb,
  IconCircleCheck,
  // IconKeyboard,
  IconPointer,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

const App = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState<string>("");
  const [messages, setMessages] = useState<{ type: string; message: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [currentApp, setCurrentApp] = useState<{
    appName: string;
    bundleId?: string;
    status: string;
  } | null>(null);
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

    window.ipcRenderer.on(
      "app-info",
      (_, data: { appName: string; bundleId?: string; status: string }) => {
        setCurrentApp(data);
      }
    );

    (window.ipcRenderer as any).onAccessibilityEnabled(() => {
      setMessages((prev) => [
        ...prev,
        {
          type: "complete",
          message:
            "✅ Accessibility permissions enabled! You can now use Opus to control your apps.",
        },
      ]);
    });

    return () => {
      window.ipcRenderer.removeAllListeners("reply");
      window.ipcRenderer.removeAllListeners("app-info");
      (window.ipcRenderer as any).removeAllListeners("accessibility-enabled");
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const currentPrompt = prompt;

    setMessages([]);
    setLoading(true);
    setCurrentApp(null);
    setShowPrompt(currentPrompt);
    setPrompt("");

    inputRef.current?.blur();
    window.ipcRenderer.sendMessage(currentPrompt);
  };

  const handleStop = () => {
    setLoading(false);
    setCurrentApp(null);
    setShowPrompt("");
    setMessages((prev) => [
      ...prev,
      {
        type: "error",
        message: "Operation stopped by user.",
      },
    ]);
    // Send stop signal to main process
    window.ipcRenderer.sendStop();
  };

  const getIconForMessageType = (type: string) => {
    switch (type) {
      case "error":
        return (
          <IconCircleCheck size={20} stroke={1.5} className="text-red-500" />
        );
      case "complete":
        return (
          <IconCircleCheck size={20} stroke={1.5} className="text-green-500" />
        );
      case "action":
        return <IconPointer size={20} stroke={1.5} className="text-blue-500" />;
      default:
        return <IconBulb size={20} stroke={1.5} className="text-yellow-500" />;
    }
  };

  const isAccessibilityError = (message: string) => {
    return (
      message.toLowerCase().includes("accessibility") ||
      message.toLowerCase().includes("permission")
    );
  };

  const isScreenshotError = (message: string) => {
    return (
      message.toLowerCase().includes("unsupported image") ||
      message.toLowerCase().includes("400") ||
      message.toLowerCase().includes("screenshot")
    );
  };

  // const getIconForTool = (toolName: string) => {
  //   if (toolName?.toLowerCase().includes("safari")) {
  //     return (
  //       <IconBrandSafari size={20} stroke={1.5} className="text-neutral-500" />
  //     );
  //   }
  //   if (
  //     toolName?.toLowerCase().includes("key") ||
  //     toolName?.toLowerCase().includes("type")
  //   ) {
  //     return (
  //       <IconKeyboard size={20} stroke={1.5} className="text-neutral-500" />
  //     );
  //   }
  //   if (toolName?.toLowerCase().includes("click")) {
  //     return (
  //       <IconPointer size={20} stroke={1.5} className="text-neutral-500" />
  //     );
  //   }
  //   return <IconBulb size={20} stroke={1.5} className="text-neutral-500" />;
  // };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950">
      {showPrompt && (
        <div className="px-4 py-3 flex items-center justify-between text-zinc-200 text-lg border-b border-zinc-800 bg-zinc-900/75 font-600">
          <div className="flex items-center gap-2">
            <IconSparkles size={24} stroke={2} className="font-neutral-200" />
            {showPrompt}
          </div>
          {loading && (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              <IconX size={16} />
              Stop
            </button>
          )}
        </div>
      )}
      {currentApp && (
        <div className="px-4 py-2 flex items-center gap-2 text-zinc-200 text-base border-b border-zinc-800/50 bg-zinc-900/50">
          <div
            className={`w-2 h-2 rounded-full ${
              currentApp.status === "ready"
                ? "bg-green-400"
                : "bg-yellow-400 animate-pulse"
            }`}
          />
          <span className="font-medium text-zinc-300">App:</span>
          <span className="text-zinc-100">{currentApp.appName}</span>
          {currentApp.status === "opening" && (
            <span className="text-yellow-400 text-sm">Opening...</span>
          )}
          {currentApp.status === "ready" && (
            <span className="text-green-400 text-sm">Ready</span>
          )}
        </div>
      )}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 text-white text-md box-border">
          {loading ? (
            <div className="grid place-items-center h-full">
              <div className="mb-3 p-3 rounded-lg flex flex-col gap-2 bg-zinc-900/75 border-[1px] border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <IconBulb
                    size={20}
                    stroke={1.5}
                    className="text-yellow-500"
                  />
                  <div className="whitespace-pre-wrap text-sm text-neutral-200">
                    Reasoning...
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-3 p-3 rounded-lg flex items-center gap-2 border-[1px] ${
                    isAccessibilityError(msg.message)
                      ? "bg-red-900/25 border-red-800/50"
                      : isScreenshotError(msg.message)
                      ? "bg-orange-900/25 border-orange-800/50"
                      : "bg-zinc-900/75 border-zinc-800/50"
                  }`}
                >
                  {getIconForMessageType(msg.type)}
                  <div className="whitespace-pre-wrap text-sm text-neutral-200">
                    {msg.message}
                    {isAccessibilityError(msg.message) && (
                      <div className="mt-2 text-xs text-red-300">
                        💡 Tip: After enabling accessibility in System Settings,
                        try your prompt again.
                      </div>
                    )}
                    {isScreenshotError(msg.message) && (
                      <div className="mt-2 text-xs text-orange-300">
                        💡 Tip: This might be due to screen recording
                        permissions. Try enabling screen recording for Opus in
                        System Settings → Privacy & Security → Screen Recording.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-zinc-900/75 rounded-lg border-[1px] border-zinc-800/50"
      >
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="order sandblasters on amazon..."
          disabled={loading}
          className="flex-1 text-md px-4 py-3 border-none outline-none text-white placeholder-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={prompt.length === 0 || loading}
          className={`text-md w-8 h-8 mr-2 rounded-full font-bold transition-color duration-150 ${
            prompt.length === 0 || loading
              ? "border-[1px] border-zinc-700 bg-zinc-800 text-zinc-200 opacity-50"
              : "border-none bg-gray-300 hover:bg-gray-100 text-zinc-900"
          }`}
        >
          ↑
        </button>
      </form>
    </div>
  );
};

export default App;
