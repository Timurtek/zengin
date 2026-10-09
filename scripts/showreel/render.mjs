// Renders reel.html frame by frame with headless Chrome, then encodes with ffmpeg.
//   node render.mjs stills 0.5 3 9.2 ...   -> out/stills/t<time>.png
//   node render.mjs video [--fps 60] [--sub 2] [--workers 6]
//   add --portrait to either for the 9:16 cut (1080x1920, for Reels and Stories)
// --sub N renders N sub-frames per output frame and blends them: real motion blur on the fast moves.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(resolve(here, "../../examples/marketing-site/package.json"));
const puppeteer = req("puppeteer-core");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = process.env.FFMPEG;
const args = process.argv.slice(2);
const portrait = args.includes("--portrait");
const [VW, VH] = portrait ? [1080, 1920] : [1920, 1080];
const url = pathToFileURL(join(here, "reel.html")).href + "?render" + (portrait ? "&portrait" : "");
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const mode = args.shift();
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? Number(args[i + 1]) : d; };
const times = args.filter((a, i) => /^\d/.test(a) && !["--fps", "--sub", "--workers", "--dur"].includes(args[i - 1]));

async function openPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.ready);
  return page;
}
const shot = async (page, t, path) => {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path, type: "png", clip: { x: 0, y: 0, width: VW, height: VH }, optimizeForSpeed: true });
};

const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 120000, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
// one browser per worker: a background tab in a shared browser does not paint, so its screenshots hang
const browsers = [];
const browser = await launch(); browsers.push(browser);
try {
  if (mode === "stills") {
    const dir = join(out, portrait ? "stills-9x16" : "stills"); mkdirSync(dir, { recursive: true });
    const page = await openPage(browser);
    for (const a of times) { const p = join(dir, `t${Number(a).toFixed(2)}.png`); await shot(page, Number(a), p); console.log(p); }
  } else if (mode === "video") {
    if (!FFMPEG) throw new Error("set FFMPEG to an ffmpeg binary");
    const fps = opt("fps", 60), sub = opt("sub", 1), workers = opt("workers", 6), dur = opt("dur", 45);
    const rate = fps * sub, total = Math.round(dur * rate);
    const dir = join(out, portrait ? "frames-9x16" : "frames");
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
    const pages = await Promise.all(Array.from({ length: workers }, async (_, i) => { const b = i === 0 ? browser : await launch(); if (i) browsers.push(b); return openPage(b); }));
    let next = 0, done = 0; const start = Date.now();
    await Promise.all(pages.map(async (page) => {
      while (next < total) {
        const i = next++;
        // sample at the centre of each sub-frame's interval
        await shot(page, (i + 0.5) / rate, join(dir, `f${String(i).padStart(6, "0")}.png`));
        if (++done % 200 === 0) { const s = (Date.now() - start) / 1000; console.log(`${done}/${total}  ${(done / s).toFixed(1)} fps  eta ${((total - done) / (done / s)).toFixed(0)}s`); }
      }
    }));
    console.log(`frames done in ${((Date.now() - start) / 1000).toFixed(0)}s`);
    const audio = join(out, "score.wav");
    const vf = sub > 1 ? `tmix=frames=${sub}:weights=${Array(sub).fill(1).join(" ")},select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB)` : "null";
    const ff = [
      "-y", "-framerate", String(rate), "-i", join(dir, "f%06d.png"),
      ...(existsSync(audio) ? ["-i", audio] : []),
      "-vf", `${vf},format=yuv420p`, "-r", String(fps),
      "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation", "-movflags", "+faststart",
      ...(existsSync(audio) ? ["-c:a", "aac", "-b:a", "256k", "-shortest"] : []),
      join(out, portrait ? "zengin-showreel-9x16.mp4" : "zengin-showreel.mp4"),
    ];
    await new Promise((res, rej) => { const p = spawn(FFMPEG, ff, { stdio: "inherit" }); p.on("exit", (c) => (c ? rej(new Error("ffmpeg " + c)) : res())); });
    console.log(join(out, portrait ? "zengin-showreel-9x16.mp4" : "zengin-showreel.mp4"));
  } else {
    console.log("usage: node render.mjs stills <t...> | video [--fps 60] [--sub 2] [--workers 6]");
  }
} finally {
  await Promise.all(browsers.map((b) => b.close()));
}
