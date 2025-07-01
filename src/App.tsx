import { useState, useEffect, useRef } from "react";
import {
  IconExclamationCircle,
  IconInfoCircle,
  IconSend2,
  IconBubble,
  IconKeyboard,
  IconPointer,
  IconCamera,
  IconCircleCheck,
  IconClick,
  IconMenu2,
} from "@tabler/icons-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

const iconMap = {
  thinking: IconBubble,
  info: IconInfoCircle,
  error: IconExclamationCircle,
  typing: IconKeyboard,
  type: IconKeyboard,
  press: IconKeyboard,
  scroll: IconKeyboard,
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

type task = {
  title: string;
  messages: message[];
  prompt: string;
};

const App = () => {
  const [prompt, setPrompt] = useState("");
  const [sentPrompts, setSentPrompts] = useState<string[]>([]);
  const [largeAndToTheRight, setLargeAndToTheRight] = useState<boolean>(false);
  const [messages, setMessages] = useState<message[]>([]);
  const [tasks, setTasks] = useState<task[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [opusIconHovered, setOpusIconHovered] = useState<boolean>(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLInputElement>(null);

  const [messagesRef] = useAutoAnimate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 5) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    window.ipcRenderer.on("reply", (_, data: message) => {
      setMessages((prev) => {
        const exists = prev.some(
          (msg) => msg.type === data.type && msg.message === data.message
        );
        return exists ? prev : [...prev, data];
      });
    });
    window.ipcRenderer.on("update-tasks", (_, data: task[]) => {
      setTasks(data);
    });
  }, []);

  const handleSubmit = () => {
    inputRef.current?.blur();
    if (!largeAndToTheRight) {
      setLargeAndToTheRight(true);
    }
    setMessages([]);
    setSentPrompts([prompt]);

    window.ipcRenderer.sendMessage(prompt);
    setPrompt("");
  };

  const handleSidebarButtonClicked = () => {
    window.ipcRenderer.send("resize", 500, 500);
    setSidebarOpen(true);
    setLargeAndToTheRight(true);
  };

  return (
    <div className="bg-bg h-screen">
      {largeAndToTheRight && sentPrompts.length ? (
        <div className="fixed top-0 bg-bg z-20 px-6 pt-16 w-full">
          <p className="text-white/65 mb-4">{sentPrompts[0]}</p>
          <div className="border-b-1 border-white/25"></div>
        </div>
      ) : (
        <></>
      )}

      {largeAndToTheRight ? <div className="pb-28"></div> : <></>}

      <div className="flex flex-col bg-bg text-tx px-4 bg-2">
        <div className="flex-grow">
          {largeAndToTheRight && messages.length === 0 && sentPrompts.length ? (
            <div className={"px-6 py-4 rounded-md my-4 ring-2 ring-ui bg-bg-2"}>
              <div className="flex gap-2 items-center">
                <IconBubble stroke={1.5} />
                <p>Opus is thinking...</p>
              </div>
            </div>
          ) : (
            <></>
          )}

          <div ref={messagesRef} className="pb-8">
            {messages.map(({ type, message }, i) => {
              console.log(type, message);
              const verb = message.split(" ")[0].toLowerCase();

              if (!(type in iconMap)) type = "info";
              if (verb in iconMap) type = verb;

              const Icon = iconMap[type as iconType];
              const bg =
                type in specialColors
                  ? specialColors[type as specialColorType].bgColor
                  : "bg-bg-2";
              const ring =
                type in specialColors
                  ? specialColors[type as specialColorType].ringColor
                  : "ring-transparent";
              const color =
                type in specialColors
                  ? specialColors[type as specialColorType].color
                  : "";

              const titleCaseType = type[0].toUpperCase() + type.slice(1);

              return (
                <div
                  key={i}
                  className={
                    "px-6 py-4 rounded-md flex flex-col gap-2 my-4 ring-1 " +
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
          </div>
          <div ref={messagesEndRef} />
          {messages.length == 0 && <br />}
        </div>

        {largeAndToTheRight ? (
          <button
            className="fixed top-8 left-8 z-[999]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <IconMenu2 />
          </button>
        ) : (
          <div className="mb-4 text-white">
            <h1 className="font-[Comorant_Garamond] font-serif text-2xl text-tx flex items-center gap-2 font-bold">
              <button
                onMouseEnter={() => setOpusIconHovered(true)}
                onMouseLeave={() => setOpusIconHovered(false)}
                className="hover:brightness-115"
                onClick={handleSidebarButtonClicked}
              >
                {opusIconHovered ? <IconMenu2 /> : <IconClick />}
              </button>{" "}
              Opus
            </h1>
          </div>
        )}

        {sidebarOpen && (
          <div className="overlay top-0 left-0 absolute w-full h-screen bg-black/50 z-50 transition duration-500"></div>
        )}
        <nav
          className={
            "fixed top-0 w-1/3 h-screen bg-bg-2 border-ui border flex flex-col p-8 rounded-md duration-500 z-100" +
            (sidebarOpen ? " left-0" : " -left-1/3")
          }
        >
          <h2 className="font-bold text-xl mb-2 ml-8 translate-y-[-3px]">
            Tasks
          </h2>
          {tasks.length
            ? tasks.map((task) => (
                <button
                  onClick={() => {
                    const selectedTask = tasks.find(
                      (t) => t.title === task.title
                    );
                    setSentPrompts([selectedTask?.title || ""]);
                    setMessages(selectedTask?.messages || []);
                  }}
                >
                  {task.title}
                </button>
              ))
            : "No tasks found. Create one by entering a prompt!"}
        </nav>

        <form
          className="w-full fixed bottom-0 left-0 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              largeAndToTheRight && sentPrompts.length
                ? "Provide more info..."
                : "Enter your prompt..."
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
