// End-to-end test: launches the built app like a user would, as a fresh install.
//
//   npm test                        downloads the model for real (238 MB)
//   KHOPESH_MODEL=path npm test     reuses a model file you already have
//   npm run screenshots             also saves README screenshots and the demo GIF to docs/images
//
// The only thing faked is the native file picker, which a script can't click through.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const shotsDir = process.argv.includes("--screenshots") ? join(root, "docs", "images") : null;
const userData = mkdtempSync(join(tmpdir(), "khopesh-e2e-data-"));
const music = mkdtempSync(join(tmpdir(), "khopesh-e2e-music-"));

// A synthetic "song": a chord pad, a wobbly lead line and a beat, as 44.1 kHz stereo float WAV.
const writeSong = (name, seconds, seed) => {
  const rate = 44100, frames = rate * seconds;
  const data = Buffer.alloc(frames * 8);
  const chord = [220, 277.18, 329.63].map((f) => f * (1 + seed * 0.12));
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const pad = chord.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) * 0.12;
    const lead = Math.sin(2 * Math.PI * (440 + 12 * Math.sin(2 * Math.PI * 5 * t)) * t) * 0.18 * (Math.sin(t * 1.3) > -0.3 ? 1 : 0);
    const beat = (t % 0.5) < 0.04 ? (Math.random() * 2 - 1) * 0.35 * (1 - (t % 0.5) / 0.04) : 0;
    data.writeFloatLE(pad + lead + beat, i * 8);
    data.writeFloatLE(pad + lead * 0.9 + beat, i * 8 + 4);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 8, 28); header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  const path = join(music, name);
  writeFileSync(path, Buffer.concat([header, data]));
  return path;
};

const songs = [
  writeSong("Midnight Drive.wav", 90, 0),
  writeSong("Golden Hour.wav", 20, 1),
  writeSong("Desert Rose.wav", 20, 2),
];
const notAudio = join(music, "lyrics.txt");
writeFileSync(notAudio, "not audio");

if (process.env.KHOPESH_MODEL) {
  mkdirSync(join(userData, "models"), { recursive: true });
  copyFileSync(process.env.KHOPESH_MODEL, join(userData, "models", "becruily_deux-Q8_0.gguf"));
}

// Screenshots render at 2x so they stay sharp on high-DPI screens and GitHub.
const scaleArgs = shotsDir ? ["--force-device-scale-factor=2"] : [];
// KHOPESH_APP=path/to/packaged/executable tests a packaged build instead of the dev build.
const app = await _electron.launch({
  ...(process.env.KHOPESH_APP ? { executablePath: process.env.KHOPESH_APP, args: scaleArgs } : { args: [...scaleArgs, root] }),
  env: { ...process.env, KHOPESH_USER_DATA: userData },
});
const page = await app.firstWindow();
const shot = async (name) => shotsDir && page.screenshot({ path: join(shotsDir, `${name}.png`) });
const step = (message) => console.log(`✓ ${message}`);
const percentOf = async (item) => Number((await item.locator(".progress-info span").nth(1).textContent()).replace("%", ""));
const pickFiles = (paths) =>
  app.evaluate(({ dialog }, files) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
  }, paths);

if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Records the window while the queue runs, for the README's animated demo.
const framesDir = join(root, ".cache", "frames");
let recording = null;
const startRecording = () => {
  if (!shotsDir) return;
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const state = { on: true, count: 0 };
  recording = (async () => {
    while (state.on) {
      await page.screenshot({ path: join(framesDir, `frame-${String(state.count++).padStart(4, "0")}.png`) });
      await page.waitForTimeout(500);
    }
  })();
  recording.state = state;
};
const stopRecording = async () => {
  if (!recording) return;
  recording.state.on = false;
  await recording;
  const last = join(framesDir, `frame-${String(recording.state.count - 1).padStart(4, "0")}.png`);
  for (let i = 0; i < 16; i++) copyFileSync(last, join(framesDir, `frame-${String(recording.state.count + i).padStart(4, "0")}.png`));
  try {
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", "-framerate", "10", "-i", join(framesDir, "frame-%04d.png"),
      "-vf", "scale=460:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
      join(shotsDir, "demo.gif"),
    ]);
  } catch {
    console.log("  (ffmpeg not found, skipped demo.gif)");
  }
};

try {
  // First run: model download
  if (!process.env.KHOPESH_MODEL) {
    await page.getByText("Download model").waitFor();
    await shot("setup");
    await page.getByText("Download model").click();
    const bar = page.locator(".setup .progress");
    await bar.waitFor();
    while ((await percentOf(page.locator(".setup"))) < 45) await page.waitForTimeout(250);
    await shot("downloading");
    step("model download started and shows progress");
  }
  await page.getByText("Drop songs here").waitFor({ timeout: 10 * 60_000 });
  await shot("home");
  step("model ready, drop zone shown");

  // Queue: three songs plus a file that isn't audio
  await pickFiles([...songs, notAudio]);
  startRecording();
  await page.waitForTimeout(1200);
  await page.locator(".dropzone").click();
  const items = page.locator(".queue-item");
  await items.nth(3).waitFor();
  assert.equal(await items.count(), 4);
  assert.match(await items.nth(3).textContent(), /Unsupported file type/);
  step("queue accepts several files and rejects non-audio");

  const first = items.nth(0);
  await first.locator(".progress").waitFor();
  while ((await percentOf(first)) < 40) await page.waitForTimeout(200);
  assert.match(await items.nth(1).textContent(), /Waiting/);
  await shot("splitting");
  step("one song splits at a time with live progress");

  await page.getByText("Clear list").waitFor({ timeout: 10 * 60_000 });
  assert.equal(await page.locator(".queue-item.done").count(), 3);
  for (const song of songs) {
    const base = song.replace(/\.wav$/, "");
    assert.ok(existsSync(`${base} - VOCALS.wav`) && existsSync(`${base} - INSTRUMENTS.wav`), `stems for ${base}`);
  }
  await shot("done");
  await stopRecording();
  step("all stems saved next to the originals");

  await app.evaluate(({ shell }) => {
    shell.showItemInFolder = (path) => { globalThis.shownPath = path; };
  });
  await first.getByRole("button").click();
  assert.match(await app.evaluate(() => globalThis.shownPath), /Midnight Drive - VOCALS\.wav$/);
  step("“Show in folder” points at the stems");

  // Settings persist across restarts of the window
  await page.locator(".icon-button").click();
  await page.getByText("Chunk size").waitFor();
  await shot("settings");
  await page.locator("select").first().selectOption("286650");
  await page.reload();
  await page.locator(".icon-button").click();
  assert.equal(await page.locator("select").first().inputValue(), "286650");
  await page.getByText("Reset to defaults").click();
  assert.equal(await page.locator("select").first().inputValue(), "143325");
  await page.locator(".icon-button").click();
  step("settings save and reset");

  // Stop cancels the running split
  await pickFiles([songs[0]]);
  await page.locator(".dropzone").click();
  const running = page.locator(".queue-item.splitting");
  await running.waitFor();
  while ((await percentOf(running)) < 20) await page.waitForTimeout(200);
  await page.getByText("Stop").click();
  await page.locator(".queue-item.cancelled").waitFor();
  assert.ok(!existsSync(join(music, "Midnight Drive (2) - VOCALS.wav")), "cancelled split leaves no stems");
  step("stop cancels cleanly");

  console.log("\nAll end-to-end checks passed.");
} finally {
  await app.close();
  rmSync(userData, { recursive: true, force: true });
  rmSync(music, { recursive: true, force: true });
}
