import { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, shell } from "electron";
import { join } from "path";
import { AUDIO_EXTENSIONS, type SplitProgress, type SplitSettings } from "../shared/types";
import { downloadModel, isModelReady, MODEL } from "./model";
import { cancelActive } from "./runner";
import { splitFile } from "./split";

const isMac = process.platform === "darwin";

// Keeps the model and settings somewhere else, e.g. a fresh folder for a first-run test.
if (process.env.KHOPESH_USER_DATA) app.setPath("userData", process.env.KHOPESH_USER_DATA);

const resourcesDir = () =>
  app.isPackaged ? process.resourcesPath : join(app.getAppPath(), "resources");
const binDir = () => join(resourcesDir(), "bin", process.platform === "win32" ? "windows" : "macos");
const modelPath = () => join(app.getPath("userData"), "models", MODEL.file);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 460,
    height: 620,
    minWidth: 380,
    minHeight: 520,
    title: "Khopesh",
    backgroundColor: "#12100e",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // The UI is local and never navigates; block anything that tries (e.g. a stray file drop).
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else win.loadFile(join(__dirname, "../renderer/index.html"));
  return win;
};

// Long queues shouldn't stall because the Mac went idle.
const keepAwake = async <T>(task: () => Promise<T>) => {
  const id = powerSaveBlocker.start("prevent-app-suspension");
  try {
    return await task();
  } finally {
    powerSaveBlocker.stop(id);
  }
};

app.whenReady().then(() => {
  const win = createWindow();
  const sendProgress = (progress: SplitProgress) => win.webContents.send("progress", progress);

  ipcMain.handle("choose-files", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Audio and video", extensions: AUDIO_EXTENSIONS }],
    });
    return result.canceled ? [] : result.filePaths;
  });
  ipcMain.handle("is-model-ready", () => isModelReady(modelPath()));
  ipcMain.handle("download-model", () =>
    downloadModel(modelPath(), (percent) => sendProgress({ stage: "Downloading model", percent })));
  ipcMain.handle("split", (_event, filePath: string, settings: SplitSettings) =>
    keepAwake(() => splitFile(filePath, binDir(), modelPath(), settings, sendProgress)));
  ipcMain.on("cancel", () => cancelActive());
  ipcMain.on("show-in-folder", (_event, filePath: string) => shell.showItemInFolder(filePath));
});

app.on("window-all-closed", () => {
  cancelActive();
  app.quit();
});
