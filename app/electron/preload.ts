import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  sendMessage: (msg: string) => ipcRenderer.send("message", msg),
  onReply: (callback: (data: string) => void) =>
    ipcRenderer.on("reply", (_, data) => callback(data)),
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),

  // New conversational interface methods
  resetConversation: () => ipcRenderer.send("reset-conversation"),
  changeApp: (appName: string) => ipcRenderer.send("change-app", appName),
  onAppChanged: (callback: (data: { appName: string }) => void) =>
    ipcRenderer.on("app-changed", (_, data) => callback(data)),

  // You can expose other APTs you need here.
  // ...
});
