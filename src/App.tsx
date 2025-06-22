import { useState, FormEvent, useEffect, useRef } from "react";
import {
  IconNote,
  IconExclamationCircle,
  IconInfoCircle,
  IconSend2,
  IconBubble,
  IconKeyboard,
  IconPointer,
  IconCamera,
  IconCircleCheck,
  IconClick,
} from "@tabler/icons-react";
import CodeBlock from "./components/CodeBlock";
import { useWhisper } from "./hooks/useWhisper/useWhisper";

const iconMap = {
  task: IconNote,
  thinking: IconBubble,
  info: IconInfoCircle,
  error: IconExclamationCircle,
  typing: IconKeyboard,
  click: IconPointer,
  screenshot: IconCamera,
  complete: IconCircleCheck,
};

const specialColors = {
  error: {
    ringColor: "ring-re/50",
    bgColor: "bg-re/15",
    color: "text-re/90",
  },
  info: {
    ringColor: "ring-bl/50",
    bgColor: "bg-bl/15",
    color: "text-bl",
  },
  complete: {
    ringColor: "ring-gr/50",
    bgColor: "bg-gr/15",
    color: "text-gr/90",
  },
};

type iconType = keyof typeof iconMap;
type specialColorType = keyof typeof specialColors;

type message = {
  type: string;
  message: string;
};

const App = () => {
  const [prompt, setPrompt] = useState("");
  const [sentPrompts, setSentPrompts] = useState<string[]>([]);
  const [firstPromptSent, setFirstPromptSent] = useState<boolean>(false);
  const [messages, setMessages] = useState<message[]>([]);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 5) {
      scrollToBottom();
    }
  }, [messages]);
  const { recording, startRecording, stopRecording, transcript } = useWhisper({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    streaming: true,
    timeSlice: 1_000, // 1 second
    nonStop: true, // keep recording as long as the user is speaking
    stopTimeout: 5000, // auto stop after 5 seconds
    removeSilence: true,
  });

  useEffect(() => {
    window.ipcRenderer.on("reply", (_, data: message) => {
      setMessages((prev) => [...prev, data]);
    });
  }, []);

  useEffect(() => {
    if (transcript.text && recording) setPrompt(transcript.text);
  }, [transcript.text]);

  useEffect(() => {
    if (!recording && prompt != "") {
      handleSubmit();
    }
  }, [recording]);

  const handleSubmit = () => {
    stopRecording();

    if (!firstPromptSent) {
      setFirstPromptSent(true);
    }
    setMessages([]);
    setSentPrompts([prompt]);
    window.ipcRenderer.sendMessage(prompt);
    setPrompt("");
  };

  return (
    <div className="bg-bg h-screen">
      {firstPromptSent && (
        <div className="mb-16">
          <div className="fixed top-0 bg-bg px-6 pt-6 w-full">
            <p className="text-white/65 mb-4">{sentPrompts[0]}</p>
            <div className="border-b-1 border-white/25"></div>
          </div>
        </div>
      )}

      <div className="flex flex-col bg-bg text-tx px-4 bg-2">
        <div className="flex-grow">
          {firstPromptSent && messages.length === 0 && (
            <div className={"px-6 py-4 rounded-md my-4 ring-2 ring-ui bg-bg-2"}>
              <div className="flex gap-2 items-center">
                <IconBubble stroke={1.5} />
                <p>Opus is thinking...</p>
              </div>
            </div>
          )}
          {messages.map(({ type, message }, i) => {
            console.log(type, message);
            if (!(type in iconMap)) type = "info";
            const Icon = iconMap[type as iconType];
            const bg =
              type in specialColors
                ? specialColors[type as specialColorType].bgColor
                : "bg-bg-2";
            const ring =
              type in specialColors
                ? specialColors[type as specialColorType].ringColor
                : "";
            const color =
              type in specialColors
                ? specialColors[type as specialColorType].color
                : "";

            const titleCaseType = type[0].toUpperCase() + type.slice(1);

            return (
              <div
                key={i}
                className={
                  "px-6 py-4 rounded-md flex flex-col gap-2 my-4 ring-2 " +
                  bg +
                  " " +
                  ring +
                  " " +
                  color
                }
              >
                {message.length > 100 ? (
                  <>
                    <div className="flex gap-2 items-center">
                      <Icon stroke={1.5} />
                      <strong>{titleCaseType}</strong>
                    </div>
                    <p>{message}</p>
                  </>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Icon stroke={1.5} />
                    <p>{message}</p>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          {messages.length == 0 && <br />}
        </div>

        {!firstPromptSent && (
          <div className="mb-4 ">
            <h1 className="font-[Comorant_Garamond] font-serif text-2xl text-tx flex items-center gap-2 font-bold">
              <IconClick /> Opus
            </h1>
            <p></p>
          </div>
        )}

        <form
          className="w-full fixed bottom-0 left-0 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => {
              startRecording();
            }}
            onBlur={() => {
              stopRecording();
            }}
            placeholder={
              sentPrompts ? "Provide more info..." : "Enter your prompt..."
            }
            className="flex-grow p-2 w-full h-full rounded-md bg-bg-2 focus:outline-none focus:ring focus:ring-ui-2 placeholder:text-tx-3 resize-none"
          />
          <button
            type="submit"
            className="absolute right-5 top-1/2 -translate-y-1/2 bg-tx text-bg hover:bg-white transition hover:cursor-pointer font-bold p-1 rounded-md disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-ui-2 disabled:text-white"
            disabled={prompt.length === 0}
          >
            <IconSend2 size={20} />
          </button>
        </form>
        <div className="p-3"></div>
      </div>
    </div>
  );
};

export default App;
