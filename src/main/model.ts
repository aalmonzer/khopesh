import { createHash } from "crypto";
import { createWriteStream, existsSync, statSync } from "fs";
import { mkdir, rename, rm } from "fs/promises";
import { dirname } from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream } from "stream/web";

// becruily's Mel-Band RoFormer "deux" (CC BY-NC 4.0), converted to GGUF by chenmozhijin.
export const MODEL = {
  file: "becruily_deux-Q8_0.gguf",
  url: "https://huggingface.co/chenmozhijin/BSRoformer-GGUF/resolve/main/becruily/mel-band-roformer-deux/becruily_deux-Q8_0.gguf",
  sha256: "11247b33d4487728fe95bfb8ad56b386e32e46f34f690a23407c91e93ae36d16",
  size: 237604448,
};

export const isModelReady = (path: string) => existsSync(path) && statSync(path).size === MODEL.size;

export const downloadModel = async (dest: string, onPercent: (percent: number) => void) => {
  await mkdir(dirname(dest), { recursive: true });
  const partial = `${dest}.part`;

  const response = await fetch(MODEL.url);
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed (HTTP ${response.status}). Check your connection and try again.`);
  }

  const hash = createHash("sha256");
  let received = 0;
  let lastPercent = -1;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      const percent = Math.floor((received / MODEL.size) * 100);
      if (percent !== lastPercent) onPercent((lastPercent = percent));
      done(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(response.body as ReadableStream), meter, createWriteStream(partial));

  if (hash.digest("hex") !== MODEL.sha256) {
    await rm(partial, { force: true });
    throw new Error("The downloaded model was corrupted. Please try again.");
  }
  await rename(partial, dest);
};
