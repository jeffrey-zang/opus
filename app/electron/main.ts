import "dotenv/config";
import { app, BrowserWindow, Notification, nativeImage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { setupMainHandlers } from "./mainProcessHandlers.ts";
import { execFile } from "node:child_process";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const ENV = process.env.ENV && process.env.ENV == "DEV" ? "DEV" : "PROD";
export const TMPDIR = path.join(os.tmpdir(), "opus");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "click.png"),
    // width: 500,
    // height: 56,
    width: 500,
    height: 74,
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

  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

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
  if (ENV == "DEV") {
    execFile(
      "./swift/virtualdisplay/DerivedData/virtualdisplay/Build/Products/Debug/virtualdisplay",
      ["dev"]
    );
    console.log("virtual display");
  }
  // TODO: prod version
  if (process.platform === "darwin") {
    const icon = nativeImage.createFromPath(
      path.join(process.env.VITE_PUBLIC, "click.png")
    );
    app.dock.setIcon(icon);
  }
  if (!fs.existsSync(TMPDIR)) fs.mkdirSync(TMPDIR);
  new Notification({
    title: "Hello from Opus",
    body: "Opus is ready! Type a prompt and run your first task.",
  }).show();
  createWindow();
});
