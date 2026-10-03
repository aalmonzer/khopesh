import { execFile, type ChildProcess } from "child_process";
import { realpath } from "fs/promises";
import { join, relative } from "path";
import type { SplitSettings } from "../shared/types";

type OnPercent = (percent: number) => void;

const isWindows = process.platform === "win32";
const exe = (name: string) => (isWindows ? `${name}.exe` : name);

let active: ChildProcess | null = null;

export const cancelActive = () => {
  active?.kill();
  active = null;
};

// Each tool prints its own progress format to stdout; report the latest percent seen.
const watchPercent = (pattern: RegExp, onPercent: OnPercent) => (text: string) => {
  const hits = text.match(pattern);
  if (hits) onPercent(parseInt(hits[hits.length - 1].replace(/\D/g, ""), 10));
};

const run = (bin: string, args: string[], onOutput: (text: string) => void, cwd?: string) =>
  new Promise<void>((resolve, reject) => {
    const proc = execFile(
      bin,
      args,
      { cwd, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        active = null;
        if (!err) return resolve();
        if (err.killed || err.signal) return reject(new Error("Cancelled"));
        if (err.code === "ENOENT") return reject(new Error(`Missing tool: ${bin}. Run "npm run setup".`));
        reject(new Error(stderr?.toString().trim() || err.message));
      },
    );
    proc.stdout?.on("data", (chunk) => onOutput(chunk.toString()));
    active = proc;
  });

// Windows ships up to three separator builds (CUDA only in the NVIDIA download);
// use the fastest one whose libraries load on this PC.
const WINDOWS_BACKENDS = ["cuda", "vulkan", "cpu"];
let windowsBackend: string | null = null;

const loads = (bin: string) =>
  new Promise<boolean>((resolve) =>
    execFile(bin, ["--help"], { timeout: 5000, windowsHide: true }, (err) => resolve(!err)),
  );

const separatorDir = async (binDir: string) => {
  if (!isWindows) return binDir;
  if (!windowsBackend) {
    for (const backend of WINDOWS_BACKENDS) {
      if (await loads(join(binDir, backend, exe("bs_roformer-cli")))) {
        windowsBackend = backend;
        break;
      }
    }
    // All builds link the Visual C++ runtime, so none loading almost always means it's missing.
    if (!windowsBackend) {
      throw new Error(
        "Khopesh's audio engine couldn't start. Install the Microsoft Visual C++ Redistributable (x64) " +
          "from https://aka.ms/vs/17/release/vc_redist.x64.exe and try again.",
      );
    }
  }
  return join(binDir, windowsBackend);
};

export const runAudioPrep = (binDir: string, input: string, output: string, onPercent: OnPercent) =>
  run(
    join(binDir, exe("audio-prep")),
    ["--input", input, "--output", output],
    watchPercent(/PROGRESS \d+/g, onPercent),
  );

// The prebuilt Windows separator opens files with ANSI APIs, which break on non-ASCII
// paths. So it runs inside workDir and only sees relative names. The model path is
// relative too, which keeps the user's (possibly non-ASCII) profile folder name out of it.
export const runSeparation = async (
  binDir: string,
  modelPath: string,
  workDir: string,
  inputName: string,
  outputName: string,
  settings: SplitSettings,
  onPercent: OnPercent,
) => {
  const bin = join(await separatorDir(binDir), exe("bs_roformer-cli"));
  await run(
    bin,
    [
      relative(workDir, await realpath(modelPath)), inputName, outputName,
      "--chunk-size", String(settings.chunkSize),
      "--overlap", String(settings.overlap),
    ],
    watchPercent(/\d+ %/g, onPercent),
    workDir,
  );
};
