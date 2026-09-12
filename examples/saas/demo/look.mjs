#!/usr/bin/env node
/**
 * Renders the dashboard in a real Chromium: the overview in both schemes, the customers page with the
 * detail sheet open, and billing. Writes PNGs to the directory given as the first argument (default: demo/).
 * Needs Chrome or Edge; set ZENGIN_BROWSER to an executable path to override.
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

const server = await createServer({ root: project, server: { port: 5193, strictPort: true }, logLevel: "error" });
await server.listen();
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  async function open(theme) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1360, height: 860, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    await page.goto("http://localhost:5193/", { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));
    return page;
  }
  for (const theme of ["light", "dark"]) {
    const page = await open(theme);
    await page.screenshot({ path: join(out, `overview-${theme}.png`) });
    console.log(`wrote overview-${theme}.png`);
  }
  const page = await open("light");
  await page.click("xpath/.//button[normalize-space()='Customers']");
  await page.waitForSelector("table[aria-label='Customers']");
  await page.click("table[aria-label='Customers'] tbody tr td");
  await page.waitForSelector(".z-sheet[data-state='open']", { timeout: 4000 }).catch(async () => {
    console.log("sheet probe:", await page.evaluate(() => ({ sheet: document.querySelector(".z-sheet")?.outerHTML.slice(0, 120) ?? null, selected: document.querySelectorAll("tr[aria-selected='true']").length })));
    throw new Error("sheet did not open");
  });
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: join(out, "customers.png") });
  console.log("wrote customers.png");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".z-sheet"), { timeout: 3000 });
  await page.waitForFunction(() => getComputedStyle(document.body).pointerEvents !== "none", { timeout: 3000 }); // Radix restores this a beat after unmount
  await new Promise((r) => setTimeout(r, 200));
  const billing = await page.$$("xpath/.//button[normalize-space()='Billing']");
  console.log("billing buttons:", billing.length);
  await billing[billing.length - 1].click();
  await page.waitForSelector("table[aria-label='Invoices']", { timeout: 4000 }).catch(async () => {
    console.log("probe:", await page.evaluate(() => ({ title: document.querySelector(".topbar__title")?.textContent, sheet: !!document.querySelector(".z-sheet"), dialogs: document.querySelectorAll("[role=dialog]").length })));
    throw new Error("billing did not open");
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: join(out, "billing.png") });
  console.log("wrote billing.png");
} finally {
  await browser.close();
  await server.close();
}
