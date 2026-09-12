#!/usr/bin/env node
/**
 * Renders the chat in a real Chromium: the empty state, then a scripted answer with reasoning, a tool call
 * and sources after streaming ends, in both schemes. Writes PNGs to the directory given as the first argument
 * (default: demo/). Needs Chrome or Edge; set ZENGIN_BROWSER to an executable path to override.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const out = process.argv[2] ? resolve(process.argv[2]) : here;

const CANDIDATES = [
  process.env.ZENGIN_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = CANDIDATES.find((p) => existsSync(p));
if (!executablePath) {
  console.error("No Chrome or Edge found. Set ZENGIN_BROWSER to a Chromium executable.");
  process.exit(2);
}

const server = await createServer({ root: project, server: { port: 5192, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    await page.goto("http://localhost:5192/", { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    if (theme === "light") {
      await page.screenshot({ path: join(out, "chat-empty.png") });
      console.log("wrote chat-empty.png");
    }
    // The check reply has a tool call; the color-literal reply has sources. Ask both.
    await page.click("xpath/.//button[normalize-space()='Check src/Actions.tsx']");
    await page.waitForSelector(".z-toolcall", { timeout: 10000 });
    await page.screenshot({ path: join(out, `chat-streaming-${theme}.png`) });
    console.log(`wrote chat-streaming-${theme}.png`);
    await page.waitForSelector(".z-message__actions", { timeout: 30000 });
    await page.type("textarea", "What does color-literal catch?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".z-sources", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: join(out, `chat-${theme}.png`) });
    console.log(`wrote chat-${theme}.png`);
    const reasoningOpen = await page.$eval(".z-reasoning button", (b) => b.getAttribute("aria-expanded"));
    console.log("reasoning after answer:", reasoningOpen === "false" ? "folded" : "open");
  }
} finally {
  await browser.close();
  await server.close();
}
