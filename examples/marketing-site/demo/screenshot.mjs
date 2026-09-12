#!/usr/bin/env node
/**
 * Renders the page in a real Chromium and saves demo/light.png, demo/dark.png (full page) and demo/hero-fixed.png
 * (the check panel after "Apply fixes"). Needs Chrome or Edge; set ZENGIN_BROWSER to an executable path to override.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");

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

const server = await createServer({ root: project, server: { port: 5198, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  // A fresh context per theme: the page remembers a chosen theme in localStorage, and the system preference
  // must decide here, as it does for a first visit.
  async function open(theme) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    await page.goto("http://localhost:5198/", { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    return page;
  }

  for (const theme of ["light", "dark"]) {
    const page = await open(theme);
    const stamped = await page.evaluate(() => document.documentElement.dataset.theme);
    if (stamped !== theme) throw new Error(`expected the ${theme} theme from the system preference, got ${stamped}`);
    await page.screenshot({ path: join(here, `${theme}.png`), fullPage: true });
    console.log(`wrote demo/${theme}.png`);
  }

  // The hero panel after the fixes are applied, in a browser that runs the button's transition.
  const page = await open("light");
  const apply = await page.$("xpath/.//button[starts-with(normalize-space(), 'Apply')]");
  await apply.click();
  await page.waitForSelector(".check__clean");
  await new Promise((r) => setTimeout(r, 300));
  const panel = await page.$(".check");
  await panel.screenshot({ path: join(here, "hero-fixed.png") });
  console.log("wrote demo/hero-fixed.png");

  // The surfaces tabs switch and the panel changes.
  const rollup = await page.$("xpath/.//button[@role='tab' and normalize-space()='Rollup']");
  await rollup.click();
  // Radix keeps the inactive panels mounted and empty; only the active one has content.
  await page.waitForFunction(() => document.querySelector("[role='tabpanel'][data-state='active']")?.textContent?.includes("acme/checkout"), { timeout: 3000 });
  console.log("tabs switch");
} finally {
  await browser.close();
  await server.close();
}
