// Renders the app icon and README artwork from HTML.
//   npm run art
// The hero image frames the screenshots saved by `npm run screenshots`.

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const images = path.join(root, "docs", "images");
// Offscreen rendering is always 1x, so pages render at double size with CSS zoom.
const SCALE = 2;
app.disableHardwareAcceleration();

const BLADE = `
  <defs>
    <linearGradient id="bronze" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#9a6b2f"/><stop offset="0.55" stop-color="#e2b867"/><stop offset="1" stop-color="#f6dfa3"/>
    </linearGradient>
  </defs>
  <path d="M8 58 L19 47" stroke="#6b5132" stroke-width="6" stroke-linecap="round"/>
  <path d="M15 41 L25 51" stroke="#b08a50" stroke-width="3.5" stroke-linecap="round"/>
  <path fill="url(#bronze)" d="M18 45 L30 33 C37 24 50 12 57 21 C63 30 56 44 41 46 C49 41 53 34 50 28 C47 22 40 27 34 36 L22 49 Z"/>`;

const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: transparent; }
  body { zoom: ${SCALE}; }
  body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif; color: #f2ede4; -webkit-font-smoothing: antialiased; }
  ${css}
</style></head><body>${body}</body></html>`;

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(path.join(images, file)).toString("base64")}`;

const waveform = (count, colorA, colorB, height = 120, gap = 9) =>
  Array.from({ length: count }, (_, i) => {
    const h = Math.round(height * (0.18 + 0.82 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43))));
    return `<span style="height:${h}px;background:${i < count / 2 ? colorA : colorB}"></span>`;
  }).join("").replace(/^/, `<div class="wave" style="gap:${gap}px">`) + "</div>";

// macOS-style window frame around a screenshot.
const windowFrame = (file, extraClass = "") => `
  <div class="win ${extraClass}">
    <div class="lights"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
    <img src="${dataUri(file)}">
  </div>`;

const jobs = [
  {
    out: path.join(root, "build", "icon.png"),
    width: 512,
    height: 512,
    html: page(
      `<div class="tile"><div class="glow"></div><svg viewBox="0 0 64 64">${BLADE}</svg></div>`,
      `.tile { position: absolute; left: 50px; top: 50px; width: 412px; height: 412px; border-radius: 92px;
          background: radial-gradient(circle at 30% 20%, #3a3127 0%, #1a1612 55%, #0d0b09 100%);
          box-shadow: inset 0 0 0 2px rgba(234,194,122,0.18), 0 12px 28px rgba(0,0,0,0.45);
          display: grid; place-items: center; overflow: hidden; }
       .glow { position: absolute; inset: 0; background: radial-gradient(circle at 60% 40%, rgba(217,173,95,0.22), transparent 60%); }
       svg { width: 300px; height: 300px; position: relative; filter: drop-shadow(0 8px 14px rgba(0,0,0,0.5)); }`,
    ),
  },
  {
    out: path.join(images, "banner.png"),
    width: 1280,
    height: 400,
    html: page(
      `<div class="banner">
         <div class="brand"><svg viewBox="0 0 64 64">${BLADE}</svg><h1>KHOPESH</h1></div>
         <p>Split any song into vocals and instrumental, on your own computer.</p>
         ${waveform(64, "#d9ad5f", "#5d564c", 70, 6)}
       </div>`,
      `.banner { width: 1280px; height: 400px; border-radius: 24px; overflow: hidden; position: relative;
          background: radial-gradient(ellipse at 50% -20%, #3a2f22 0%, #16130f 55%, #0e0c0a 100%);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
       .brand { display: flex; align-items: center; gap: 22px; }
       .brand svg { width: 92px; height: 92px; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.6)); }
       h1 { font-size: 76px; font-weight: 600; letter-spacing: 0.18em; color: #f2ede4; }
       p { font-size: 24px; color: #c4bcae; letter-spacing: 0.01em; }
       .wave { display: flex; align-items: center; height: 80px; margin-top: 8px; opacity: 0.85; }
       .wave span { width: 5px; border-radius: 3px; }`,
    ),
  },
  {
    out: path.join(images, "hero.png"),
    width: 1280,
    height: 720,
    html: () => page(
      `<div class="hero">
         ${windowFrame("home.png", "left")}
         ${windowFrame("splitting.png", "center")}
         ${windowFrame("done.png", "right")}
       </div>`,
      `.hero { width: 1280px; height: 720px; border-radius: 24px; overflow: hidden; position: relative;
          background: radial-gradient(ellipse at 50% 0%, #3a2f22 0%, #16130f 60%, #0e0c0a 100%); }
       .win { position: absolute; top: 70px; width: 400px; border-radius: 12px; overflow: hidden;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 30px 60px rgba(0,0,0,0.55); background: #12100e; }
       .win img { display: block; width: 400px; }
       .lights { position: absolute; top: 15px; left: 16px; display: flex; gap: 8px; }
       .lights i { width: 12px; height: 12px; border-radius: 50%; }
       .left { left: 70px; transform: rotate(-4deg) translateY(30px); opacity: 0.9; }
       .right { right: 70px; transform: rotate(4deg) translateY(30px); opacity: 0.9; }
       .center { left: 440px; top: 40px; z-index: 2; box-shadow: 0 0 0 1px rgba(234,194,122,0.25), 0 40px 80px rgba(0,0,0,0.7); }`,
    ),
  },
];

const render = async (win, { out, width, height, html }) => {
  win.setContentSize(width * SCALE, height * SCALE);
  const file = path.join(root, ".cache", "art", `${path.basename(out, ".png")}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof html === "function" ? html() : html);
  await win.loadFile(file);
  await new Promise((r) => setTimeout(r, 400));
  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.toPNG());
  const size = image.getSize();
  console.log(`✓ ${path.relative(root, out)} (${size.width}×${size.height})`);
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 100, height: 100, show: false, transparent: true, frame: false, enableLargerThanScreen: true,
      webPreferences: { offscreen: true },
    });
    for (const job of jobs) await render(win, job);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  app.quit();
});
