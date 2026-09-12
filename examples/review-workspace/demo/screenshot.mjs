#!/usr/bin/env node
/**
 * Renders the before and after ReviewCard in a real Chromium and saves demo/before.png and demo/after.png.
 * Also exercises the reject dialog end to end (open, animate, close, unmount) so the motion is verified in a
 * browser, not only in jsdom. Needs Chrome or Edge; set ZENGIN_BROWSER to an executable path to override.
 */
import { existsSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const target = join(project, "src", "ReviewCard.tsx");
const targetCss = join(project, "src", "review-card.css");

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

function place(version) {
  copyFileSync(join(here, version, "ReviewCard.tsx"), target);
  const css = join(here, version, "review-card.css");
  if (existsSync(css)) copyFileSync(css, targetCss);
  else rmSync(targetCss, { force: true });
}

const server = await createServer({ root: project, server: { port: 5199, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 860, deviceScaleFactor: 2 });

  for (const version of ["before", "after"]) {
    place(version);
    await page.goto("http://localhost:5199/", { waitUntil: "networkidle0" });
    await page.waitForSelector(".app__queue > *");
    await new Promise((r) => setTimeout(r, 400)); // let the card stylesheet swap settle
    await page.screenshot({ path: join(here, `${version}.png`) });
    console.log(`wrote demo/${version}.png`);
  }

  // The dialog, in a browser that runs animations: open, wait past the enter motion, Escape, wait past the exit motion, gone.
  const reject = await page.$("xpath/.//button[normalize-space()='Reject']");
  await reject.click();
  await page.waitForSelector(".z-dialog[data-state='open']");
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: join(here, "dialog.png") });
  console.log("wrote demo/dialog.png");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".z-dialog"), { timeout: 3000 });
  console.log("dialog opened, animated, closed and unmounted");

  // Dark theme, for the record.
  await page.click("button[aria-label='Toggle theme']");
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(here, "after-dark.png") });
  console.log("wrote demo/after-dark.png");
} finally {
  await browser.close();
  await server.close();
  place("after");
}
