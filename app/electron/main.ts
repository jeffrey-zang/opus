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

export function getSwiftPath(swiftFile: string): string {
  let swiftPath: string;
  if (ENV === "DEV") {
    swiftPath = path.join(process.env.APP_ROOT, "swift", swiftFile);
  } else {
    swiftPath = path.join(process.resourcesPath, "swift", swiftFile);
  }

  log(`getSwiftPath(${swiftFile}): ${swiftPath} (ENV: ${ENV})`);

  return swiftPath;
}

const LOG_DIR = path.join(os.homedir(), "Library", "Logs", "Opus");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFile = path.join(LOG_DIR, "opus.log");
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(logFile, logMessage);
}

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  try {
    log("Creating main window...");
    log(`APP_ROOT: ${process.env.APP_ROOT}`);
    log(`MAIN_DIST: ${MAIN_DIST}`);
    log(`RENDERER_DIST: ${RENDERER_DIST}`);
    log(`VITE_PUBLIC: ${process.env.VITE_PUBLIC}`);

    win = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, "click.png"),
      // width: 500,
      // height: 56,
      width: 500,
      height: 52,
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
        nodeIntegration: false,
      },
    });

    if (ENV === "DEV" || process.argv.includes("--debug")) {
      win.webContents.openDevTools({ mode: "detach" });
      log("Dev tools opened");
    }

    win.webContents.on("did-finish-load", () => {
      log("Window finished loading");
      win?.webContents.send(
        "main-process-message",
        new Date().toLocaleString()
      );
    });

    win.webContents.on("did-fail-load", (_, errorCode, errorDescription) => {
      log(`Failed to load: ${errorCode} - ${errorDescription}`);
    });

    if (VITE_DEV_SERVER_URL) {
      log(`Loading dev server URL: ${VITE_DEV_SERVER_URL}`);
      win.loadURL(VITE_DEV_SERVER_URL);
    } else {
      const indexPath = path.join(RENDERER_DIST, "index.html");
      log(`Loading production file: ${indexPath}`);
      if (fs.existsSync(indexPath)) {
        win.loadFile(indexPath);
      } else {
        log(`ERROR: index.html not found at ${indexPath}`);
        win.loadURL("data:text/html,<h1>Error: index.html not found</h1>");
      }
    }

    setupMainHandlers({ win });
    log("Window created successfully");
  } catch (error) {
    log(`Error creating window: ${error}`);
    console.error("Error creating window:", error);
  }
}

process.on("uncaughtException", (error) => {
  log(`Uncaught Exception: ${error.message}`);
  log(`Stack: ${error.stack}`);
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

app.on("window-all-closed", () => {
  log("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  log("App activated");
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  log("App is ready");
  log(`Environment: ${ENV}`);
  log(`Platform: ${process.platform}`);

  if (ENV == "DEV") {
    try {
      const virtualDisplayPath = path.join(
        getSwiftPath("virtualdisplay"),
        "DerivedData/virtualdisplay/Build/Products/Debug/virtualdisplay"
      );
      log(`Attempting to run virtual display: ${virtualDisplayPath}`);
      if (fs.existsSync(virtualDisplayPath)) {
        execFile(virtualDisplayPath, ["dev"]);
        log("Virtual display started");
      } else {
        log(`Virtual display not found at: ${virtualDisplayPath}`);
      }
    } catch (error) {
      log(`Error starting virtual display: ${error}`);
    }
  }

  if (process.platform === "darwin") {
    try {
      const iconPath = path.join(process.env.VITE_PUBLIC, "click.png");
      log(`Setting dock icon: ${iconPath}`);
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(icon);
        log("Dock icon set successfully");
      } else {
        log(`Icon not found at: ${iconPath}`);
      }
    } catch (error) {
      log(`Error setting dock icon: ${error}`);
    }
  }

  if (!fs.existsSync(TMPDIR)) {
    fs.mkdirSync(TMPDIR, { recursive: true });
    log(`Created temp directory: ${TMPDIR}`);
  }

  try {
    new Notification({
      title: "Hello from Opus",
      body: "Opus is ready! Type a prompt and run your first task.",
    }).show();
    log("Notification shown");
  } catch (error) {
    log(`Error showing notification: ${error}`);
  }

  createWindow();
});

app.on("ready", () => {
  log("App ready event fired");
});

app.on("will-quit", () => {
  log("App will quit");
});
