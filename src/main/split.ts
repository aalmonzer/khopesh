import { existsSync } from "fs";
import { copyFile, mkdtemp, realpath, rename, rm, unlink } from "fs/promises";
import { tmpdir } from "os";
import { basename, dirname, extname, join } from "path";
import type { SplitProgress, SplitResult, SplitSettings } from "../shared/types";
import { runAudioPrep, runSeparation } from "./runner";

// File names can contain characters Windows forbids.
const safeFileName = (name: string) =>
  name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim() || "audio";

// Never overwrite stems from an earlier split: "Song (2) - VOCALS.wav", ...
const freeBase = (base: string) => {
  const taken = (b: string) => existsSync(`${b} - VOCALS.wav`) || existsSync(`${b} - INSTRUMENTS.wav`);
  let candidate = base;
  for (let n = 2; taken(candidate); n++) candidate = `${base} (${n})`;
  return candidate;
};

// rename() fails across volumes, e.g. from the temp folder to an external drive.
const moveFile = async (from: string, to: string) => {
  try {
    await rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
    await copyFile(from, to);
    await unlink(from);
  }
};

export const splitFile = async (
  input: string,
  binDir: string,
  modelPath: string,
  settings: SplitSettings,
  onProgress: (progress: SplitProgress) => void,
): Promise<SplitResult> => {
  // Real path: macOS's temp folder sits behind a symlink, which would break the
  // relative model path the separator is given.
  const workDir = await realpath(await mkdtemp(join(tmpdir(), "khopesh-")));
  try {
    // Separation dominates the runtime, so it gets most of the bar.
    onProgress({ stage: "Preparing audio", percent: 0 });
    await runAudioPrep(binDir, input, join(workDir, "input.wav"), (p) =>
      onProgress({ stage: "Preparing audio", percent: p * 0.05 }));

    onProgress({ stage: "Separating vocals", percent: 5 });
    await runSeparation(binDir, modelPath, workDir, "input.wav", "stems.wav", settings, (p) =>
      onProgress({ stage: "Separating vocals", percent: 5 + p * 0.94 }));

    onProgress({ stage: "Saving", percent: 99 });
    const base = freeBase(join(dirname(input), safeFileName(basename(input, extname(input)))));
    const result = { vocals: `${base} - VOCALS.wav`, instrumental: `${base} - INSTRUMENTS.wav` };
    await moveFile(join(workDir, "stems_stem_0.wav"), result.vocals);
    await moveFile(join(workDir, "stems_stem_1.wav"), result.instrumental);
    return result;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
