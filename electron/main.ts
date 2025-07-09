import "dotenv/config";
import { app, BrowserWindow, Notification, nativeImage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setupMainHandlers } from "./mainProcessHandlers.ts";
import { resetAgents } from "./ai.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

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
    height: 500,
    resizable: false,
    alwaysOnTop: false,
    ...(process.platform === "darwin"
      ? {
          trafficLightPosition: { x: -100, y: -100 },
          autoHideMenuBar: true,
          titleBarStyle: "hiddenInset",
          frame: false,
        }
      : {
          autoHideMenuBar: true,
          frame: true,
        }),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });
  // win.webContents.openDevTools({ mode: "detach" });

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // Reset agents to ensure they have the latest instructions
  resetAgents();
  setupMainHandlers({ win });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
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
    icon: process.platform === "win32" ? path.join(process.env.VITE_PUBLIC, "click.png") : undefined,
  }).show();
  createWindow();
});
