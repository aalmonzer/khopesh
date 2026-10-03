import { useEffect, useRef, useState, type DragEvent } from "react";
import { AUDIO_EXTENSIONS, type SplitProgress, type SplitResult, type SplitSettings } from "../../shared/types";
import { KhopeshMark, SplitWaveIcon, WrenchIcon } from "./icons";
import { Settings } from "./Settings";
import { loadSettings, saveSettings } from "./settingsStore";

type ModelState = "checking" | "missing" | "downloading" | "ready";
type Status = "queued" | "splitting" | "done" | "error" | "cancelled";

interface Item {
  id: number;
  path: string;
  status: Status;
  result?: SplitResult;
  error?: string;
}

const api = window.khopesh;
const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const isSupported = (path: string) =>
  AUDIO_EXTENSIONS.includes(path.split(".").pop()?.toLowerCase() ?? "");
// ipcRenderer.invoke wraps errors as "Error invoking remote method 'x': Error: <message>".
const errorMessage = (err: unknown) =>
  String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const showInFolderLabel =
  api.platform === "darwin" ? "Show in Finder" : api.platform === "win32" ? "Show in Explorer" : "Show in folder";

const ProgressBar = ({ progress }: { progress: SplitProgress }) => (
  <div className="progress">
    <div className="progress-info">
      <span>{progress.stage}</span>
      <span>{Math.round(progress.percent)}%</span>
    </div>
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
    </div>
  </div>
);

export const App = () => {
  const [model, setModel] = useState<ModelState>("checking");
  const [modelError, setModelError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState<SplitProgress>({ stage: "", percent: 0 });
  const [settings, setSettings] = useState<SplitSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);
  const wasBusy = useRef(false);

  const busy = items.some((i) => i.status === "splitting" || i.status === "queued");
  const hasFinished = items.some((i) => i.status === "done" || i.status === "error" || i.status === "cancelled");

  useEffect(() => api.onProgress(setProgress), []);

  useEffect(() => {
    api.isModelReady().then((ready) => setModel(ready ? "ready" : "missing"));
  }, []);

  const update = (id: number, patch: Partial<Item>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  // Work through the queue one file at a time.
  useEffect(() => {
    if (model !== "ready" || items.some((i) => i.status === "splitting")) return;
    const next = items.find((i) => i.status === "queued");
    if (!next) return;
    update(next.id, { status: "splitting" });
    setProgress({ stage: "Starting", percent: 0 });
    api.split(next.path, settings).then(
      (result) => update(next.id, { status: "done", result }),
      (err) => {
        const message = errorMessage(err);
        update(next.id, message === "Cancelled" ? { status: "cancelled" } : { status: "error", error: message });
      },
    );
  }, [items, model, settings]);

  useEffect(() => {
    if (wasBusy.current && !busy && !document.hasFocus()) {
      new Notification("Khopesh", { body: "Your songs are split." });
    }
    wasBusy.current = busy;
  }, [busy]);

  const addFiles = (paths: string[]) =>
    setItems((list) => [
      ...list,
      ...paths.map((path): Item =>
        isSupported(path)
          ? { id: nextId.current++, path, status: "queued" }
          : { id: nextId.current++, path, status: "error", error: "Unsupported file type" }),
    ]);

  const chooseFiles = async () => addFiles(await api.chooseFiles());

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files, (file) => api.pathForFile(file)).filter(Boolean));
  };

  const stopAll = () => {
    setItems((list) => list.map((i) => (i.status === "queued" ? { ...i, status: "cancelled" } : i)));
    api.cancel();
  };

  const clearFinished = () => setItems((list) => list.filter((i) => i.status === "queued" || i.status === "splitting"));

  const updateSettings = (next: SplitSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const downloadModel = async () => {
    setModel("downloading");
    setModelError("");
    setProgress({ stage: "Downloading model", percent: 0 });
    try {
      await api.downloadModel();
      setModel("ready");
    } catch (err) {
      setModelError(errorMessage(err));
      setModel("missing");
    }
  };

  const splitView = (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`dropzone${dragging ? " dragging" : ""}${items.length ? " compact" : ""}`}
        onClick={chooseFiles}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && chooseFiles()}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {items.length === 0 && <SplitWaveIcon />}
        <div className="drop-title">Drop songs here</div>
        <div className="drop-hint">or click to choose · MP3, WAV, FLAC, M4A, video and more</div>
      </div>

      {items.length > 0 && (
        <ul className="queue">
          {items.map((item) => (
            <li key={item.id} className={`queue-item ${item.status}`}>
              <div className="item-name" title={item.path}>{fileName(item.path)}</div>
              {item.status === "splitting" && <ProgressBar progress={progress} />}
              {item.status === "queued" && <div className="item-status">Waiting…</div>}
              {item.status === "cancelled" && <div className="item-status">Cancelled</div>}
              {item.status === "error" && <div className="item-status error">{item.error}</div>}
              {item.status === "done" && item.result && (
                <div className="item-done">
                  <span className="item-status success">Vocals and instrumental saved</span>
                  <button className="button ghost small" onClick={() => api.showInFolder(item.result!.vocals)}>
                    {showInFolderLabel}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        {busy && <button className="button secondary" onClick={stopAll}>Stop</button>}
        {!busy && hasFinished && <button className="button ghost" onClick={clearFinished}>Clear list</button>}
      </div>

      <p className="footnote">Stems are saved next to the original file, as “Song - VOCALS.wav” and “Song - INSTRUMENTS.wav”.</p>
    </>
  );

  const setupView = (
    <section className="setup">
      <KhopeshMark size={72} />
      <h1>Split any song into vocals and instrumental.</h1>
      <p>
        Everything runs on your own computer. First, Khopesh needs its separation model:
        a one-time 238 MB download.
      </p>
      {model === "downloading" ? (
        <ProgressBar progress={progress} />
      ) : (
        <button className="button primary" onClick={downloadModel}>Download model</button>
      )}
      {modelError && <p className="error">{modelError}</p>}
      <p className="fine">Mel-Band RoFormer “deux” by becruily · CC BY-NC 4.0</p>
    </section>
  );

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <KhopeshMark />
          <span>Khopesh</span>
        </div>
        <button
          className={`icon-button${showSettings ? " active" : ""}`}
          title="Settings"
          onClick={() => setShowSettings((open) => !open)}
        >
          <WrenchIcon />
        </button>
      </header>

      <main className="content">
        {showSettings ? (
          <Settings settings={settings} onChange={updateSettings} />
        ) : model === "ready" ? (
          splitView
        ) : (
          model !== "checking" && setupView
        )}
      </main>
    </div>
  );
};
