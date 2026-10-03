import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { KhopeshApi, SplitProgress } from "../shared/types";

const api: KhopeshApi = {
  platform: process.platform,
  pathForFile: (file) => webUtils.getPathForFile(file),
  chooseFiles: () => ipcRenderer.invoke("choose-files"),
  isModelReady: () => ipcRenderer.invoke("is-model-ready"),
  downloadModel: () => ipcRenderer.invoke("download-model"),
  split: (filePath, settings) => ipcRenderer.invoke("split", filePath, settings),
  cancel: () => ipcRenderer.send("cancel"),
  showInFolder: (filePath) => ipcRenderer.send("show-in-folder", filePath),
  onProgress: (listener) => {
    const handler = (_event: unknown, progress: SplitProgress) => listener(progress);
    ipcRenderer.on("progress", handler);
    return () => ipcRenderer.removeListener("progress", handler);
  },
};

contextBridge.exposeInMainWorld("khopesh", api);
