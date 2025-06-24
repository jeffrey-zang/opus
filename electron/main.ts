import "dotenv/config";
import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Notification,
  nativeImage,
} from "electron";
import { fileURLToPath } from "node:url";
import { run } from "@openai/agents";
import { stepsAgent, scriptsAgent } from "./ai.ts";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs, { writeFile } from "fs";
import { Jimp } from "jimp";

app.setName("Opus");
app.setAboutPanelOptions({ applicationName: "Opus" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const execPromise = promisify(exec);

type message = {
  type: string;
  message: string;
};

type task = {
  title: string;
  messages: message[];
};

const tasks: task[] = [];

export interface ClickableItem {
  id: number;
  role: string;
  title: string;
  description: string;
}

export async function fetchAllClickableItems(): Promise<ClickableItem[]> {
  try {
    const { stdout } = await execPromise("./swift/accessibility.swift json-list");
    if (!stdout) {
      return [];
    }
    return JSON.parse(stdout) as ClickableItem[];
  } catch (error) {
    console.error("Failed to fetch clickable items:", error);
    return [];
  }
}

export async function clickItem(id: number): Promise<{
  success: boolean;
  clicked_element?: { id: number; title: string };
  error?: string;
}> {
  try {
    const { stdout } = await execPromise(`./swift/accessibility.swift click ${id}`);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`Failed to click item ${id}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    try {
      return JSON.parse(errorMessage);
    } catch {
      return { success: false, error: errorMessage };
    }
  }
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "click.png"),
    width: 500,
    height: 160,
    resizable: false,
    trafficLightPosition: { x: -100, y: -100 },
    alwaysOnTop: false,
    ...(process.platform === "darwin"
      ? {
          autoHideMenuBar: true,
          titleBarStyle: "hiddenInset",
          frame: false,
        }
      : {}),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });
  win.webContents.openDevTools({ mode: "detach" });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    const icon = nativeImage.createFromPath(
      path.join(process.env.VITE_PUBLIC, "click.png")
    );
    app.dock.setIcon(icon);
  }
  new Notification({
    title: "Hello from Opus",
    body: "Opus is ready! Type a prompt and run your first task.",
  }).show();
  createWindow();
});

ipcMain.on("resize", async (event, w, h) => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  if (win) {
    const [winWidth] = win.getSize();
    const x = Math.round(width * 0.85 - winWidth / 2);
    win.setPosition(x, 50, true);
  }

  win?.setSize(w, h, true);
});

ipcMain.on("message", async (event, msg) => {
  const currentMessages: message[] = [];

  console.log("Got message:", msg);
  win?.setSize(500, 500, true);

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  if (win) {
    const [winWidth] = win.getSize();
    const x = Math.round(width * 0.85 - winWidth / 2);
    win.setPosition(x, 50, true);
  }

  console.log("getting steps");

  const folderName = `screenshots/${Date.now()}-${msg.replaceAll(" ", "-")}`;
  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
      console.log("created folder");
    }
  } catch (err) {
    console.log("did not create folder");
    console.error(err);
  }

  const history: {
    step: string;
    script?: string;
    error?: string;
  }[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.time("while-loop-iteration");
    console.log("taking screenshot");

    console.time("fetchAllClickableItems");
    const clickableItems = await fetchAllClickableItems();
    console.timeEnd("fetchAllClickableItems");

    const clickableItemsText =
      clickableItems.length > 0
        ? `\n\nHere is a list of clickable elements on the screen:\n${clickableItems
            .map(
              (item) =>
                `  - ID: ${item.id}, Role: ${item.role}, Title: ${item.title}`
            )
            .join("\n")}`
        : "";
    console.log(clickableItemsText);

    // const tmpPath = path.join(os.tmpdir(), "temp_screenshot.png");
    const tmpPath = path.join(__dirname, `${Date.now()}-screenshot.png`);

    console.time("screenshot-and-process");
    await execPromise(`screencapture -C -x "${tmpPath}"`);
    const image = await Jimp.read(tmpPath);
    image.resize({ w: width, h: height });
    console.log(image.width, image.height);

    const dotColor = 0x00ff00ff; // red with full alpha
    const radius = 5;

    for (let y = 0; y < image.bitmap.height; y += 100) {
      for (let x = 0; x < image.bitmap.width; x += 100) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const dist = dx * dx + dy * dy;
            if (dist <= radius * radius) {
              image.setPixelColor(dotColor, x + dx, y + dy);
            }
          }
        }
      }
    }

    const img = await image.getBase64("image/png");
    fs.unlink(tmpPath, (err) => {
      if (err) console.error(err);
    });
    console.timeEnd("screenshot-and-process");

    const formattedHistory = history
      .map(
        (item) =>
          `- Step: ${item.step}` +
          (item.script ? `\n  - Script:\n${item.script}` : "") +
          (item.error
            ? `\n  - Status: Failed\n  - Error: ${item.error}`
            : `\n  - Status: Success`)
      )
      .join("\n\n");

    let frontApp = "";
    let structuredDOM = "";
    console.time("get-front-app-and-dom");
    try {
      const { stdout } = await execPromise(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
      );
      frontApp = stdout.trim();
      if (frontApp === "Safari") {
        const jsToInject = `function serializeDOM(node) { if (!node || node.nodeType !== 1) return null; const children = [...node.children].map(serializeDOM).filter(Boolean); return { tag: node.tagName, id: node.id || null, class: node.className || null, role: node.getAttribute('role') || null, text: node.innerText?.trim().slice(0, 100) || null, clickable: typeof node.onclick === 'function' || ['A', 'BUTTON'].includes(node.tagName), children: children.length ? children : null }; } JSON.stringify(serializeDOM(document.body));`;
        const { stdout: safariDOM } = await execPromise(
          `osascript -e 'tell application "Safari" to do JavaScript "${jsToInject.replace(
            /"/g,
            '\\"'
          )}"'`,
          { maxBuffer: 1024 * 1024 * 50 } // 50MB
        );
        structuredDOM = safariDOM;
      }
    } catch (e) {
      console.error("Could not get Safari DOM", e);
    }
    console.timeEnd("get-front-app-and-dom");

    const userContent: (
      | {
          type: "input_text";
          text: string;
        }
      | {
          type: "input_image";
          image: string;
        }
    )[] = [
      {
        type: "input_text",
        text: `Initial task request: ${msg}
  The current application in focus is ${frontApp}.
  All previous steps taken so far:
  ${formattedHistory}
  ${clickableItemsText}`,
      },
      { type: "input_image", image: img },
    ];

    const textInput = userContent[0];
    if (structuredDOM && textInput.type === "input_text") {
      console.log("structuredDom", structuredDOM);
      textInput.text += `\n\nHere is a structured JSON representation of the DOM of the current Safari page:\n${structuredDOM}`;
    }

    console.time("stepsAgent-run");
    const stepsOutput = (
      await run(stepsAgent, [{ role: "user", content: userContent }])
    ).state._currentStep;
    console.timeEnd("stepsAgent-run");
    console.log(stepsOutput);
    if (stepsOutput?.type != "next_step_final_output") return;
    const stepString = stepsOutput?.output;
    if (stepString.includes("STOP")) {
      new Notification({
        title: "Task complete",
        body: stepString.replace(" STOP", ""),
      }).show();

      event.sender.send("reply", {
        type: "complete",
        message: stepString.replace(" STOP", ""),
      });

      currentMessages.push({
        type: "complete",
        message: stepString.replace(" STOP", ""),
      });
      tasks.push({ title: msg, messages: currentMessages });
      event.sender.send("update-tasks", tasks);

      break;
    }
    new Notification({ title: "Running Step", body: stepString }).show();
    event.sender.send("reply", { type: "info", message: stepString });

    currentMessages.push({ type: "info", message: stepString });

    const clickMatch = stepString.match(/^Click element (\d+)/i);
    if (clickMatch) {
      const elementId = parseInt(clickMatch[1], 10);
      console.time("clickItem");
      const result = await clickItem(elementId);
      console.timeEnd("clickItem");
      const historyEntry = {
        step: stepString,
        script: `clickItem(${elementId})`,
        ...(result.error && { error: result.error }),
      };
      history.push(historyEntry);
      if (history.length > 5) {
        history.shift();
      }
      if (result.error) {
        console.error(`Failed to click element ${elementId}:`, result.error);
      }
      console.timeEnd("while-loop-iteration");
      continue;
    }

    console.log(`${Date.now()} - ${stepString}`);

    const base64Data = img.replace(/^data:image\/png;base64,/, "");

    console.time("writeFile-screenshot");
    writeFile(
      `${folderName}/${Date.now()}-${stepString
        .replaceAll(" ", "-")
        .replaceAll(",", "")
        .replaceAll("/", "")}.png`,
      base64Data,
      "base64",
      function (err) {
        if (err) console.log("error" + err);
        //   console.log(typeof img, img);
        console.timeEnd("writeFile-screenshot");
      }
    );

    console.time("scriptsAgent-run");
    const scriptOutput = (
      await run(scriptsAgent, [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Instruction to execute: ${stepString}
${formattedHistory ? `\nLast 5 steps:\n${formattedHistory}` : ""}
The current application in focus is ${frontApp}.
Dimensions of window: ${width}x${height}
${clickableItemsText}
${
  structuredDOM
    ? `\nHere is a structured JSON representation of the DOM of the current Safari page:\n${structuredDOM}`
    : ""
}`,
            },
            { type: "input_image", image: img },
          ],
        },
      ])
    ).state._currentStep;
    console.timeEnd("scriptsAgent-run");
    if (scriptOutput?.type != "next_step_final_output") continue;
    let script = scriptOutput?.output;

    if (script) {
      script = script.replaceAll("```applescript", "").replaceAll("```", "");
      try {
        // const scriptWithEscapedQuotes = script.replace(/"/g, '\\"');
        console.log(script);
        console.time("writeFile-script");
        writeFile("./temp/script.scpt", script, (err) => {
          if (err) console.error(err);
          console.timeEnd("writeFile-script");
        });
        console.time("run-applescript");
        const { stdout, stderr } = await execPromise(
          `osascript ./temp/script.scpt`
        );
        console.timeEnd("run-applescript");
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          history.push({ step: stepString, script, error: stderr });
          continue;
        }
        if (stdout) {
          console.log(stdout);
        }
        history.push({ step: stepString, script });
      } catch (e: unknown) {
        console.error("error executing script: ", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        history.push({ step: stepString, script, error: errorMessage });
        continue;
      }
    } else {
      history.push({ step: stepString });
    }
    if (history.length > 5) {
      history.shift();
    }
    // await new Promise((resolve) => setTimeout(resolve, 250));
    console.timeEnd("while-loop-iteration");
  }
});
