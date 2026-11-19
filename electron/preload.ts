import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../Web/types.ts";
const actions = new Set([
  "load",
  "save",
  "recover",
  "settings",
  "saveSettings",
  "ai",
  "search",
  "cancel",
  "fetchURL",
  "importFile",
  "exportProject",
  "importProject",
  "exportMarkdown",
  "openURL",
  "copyImage",
  "openAttachment",
  "revealData",
]);
const bridge: DesktopBridge = {
  invoke: (action, payload = {}) => {
    if (!actions.has(action)) return Promise.reject(new Error("不支持的操作"));
    return ipcRenderer.invoke(`mindtrace:${action}`, payload).then((result) => {
      if (result.error) throw new Error(result.error);
      return result.value;
    });
  },
  onCommand: (callback) => {
    ipcRenderer.on("mindtrace:command", (_event, command) => callback(command));
  },
  onFlush: (callback) => {
    ipcRenderer.on("mindtrace:flush", async (_event, id) => {
      try {
        await callback();
        ipcRenderer.send("mindtrace:flushed", { id, ok: true });
      } catch {
        ipcRenderer.send("mindtrace:flushed", { id, ok: false });
      }
    });
  },
};
contextBridge.exposeInMainWorld("mindtrace", bridge);
