#!/usr/bin/env node
/**
 * Proves the site's analytics in the built pages, in a real Chromium, with PostHog's endpoint intercepted:
 * - built with a key: each page sends its pageview, the create command's copy button sends
 *   install_command_copied, and every event carries app: "ZenginUI";
 * - built with a key, visitor sends Do Not Track: nothing goes to PostHog;
 * - built without a key (dev, CI, previews): nothing goes to PostHog.
 * Needs Chrome or Edge; set ZENGIN_BROWSER to an executable path to override. Run by this package's `test`;
 * `--verbose` prints every request, the page's console and the property names PostHog receives.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import puppeteer from "puppeteer-core";
import { build, preview } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, "..");
const HOST = "https://us.i.posthog.com";
const PORT = 5197;

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

/** The events in one request body, whichever encoding posthog-js chose. */
async function decode(request) {
  const url = new URL(request.url());
  // A binary body comes back from the protocol as base64; a gzip one then starts with "H4sI".
  const data = (await request.fetchPostData()) ?? "";
  if (process.argv.includes("--verbose")) console.log(`  body: ${url.pathname}${url.search} ${data.slice(0, 40)}`);
  if (!data) return [];
  let text = data;
  if (data.startsWith("H4sI")) text = gunzipSync(Buffer.from(data, "base64")).toString("utf8");
  else if (data.startsWith("data=")) text = Buffer.from(decodeURIComponent(data.slice(5)), "base64").toString("utf8");
  else if (url.searchParams.get("compression") === "base64") text = Buffer.from(data, "base64").toString("utf8");
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.batch ?? [parsed];
}

async function buildSite(key) {
  const outDir = join(project, "node_modules", ".cache", "analytics-check", key ? "with-key" : "without-key");
  rmSync(outDir, { recursive: true, force: true });
  if (key) process.env.VITE_POSTHOG_KEY = key;
  else delete process.env.VITE_POSTHOG_KEY;
  await build({ root: project, logLevel: "error", build: { outDir, emptyOutDir: true } });
  return outDir;
}

/** Opens each path, clicks what `act` clicks, and returns every event that reached PostHog's host. */
async function visit(browser, outDir, { doNotTrack = false, act } = {}) {
  const server = await preview({ root: project, logLevel: "error", build: { outDir }, preview: { port: PORT, strictPort: true } });
  const context = await browser.createBrowserContext();
  const events = [];
  const requests = [];
  try {
    const page = await context.newPage();
    // posthog-js drops events from bots, and an automated headless Chrome says it is one three ways (its user
    // agent, its brands, navigator.webdriver). A visitor's browser says none of them, so this one does not either.
    await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"));
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
      Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined });
    });
    if (doNotTrack) await page.evaluateOnNewDocument(() => Object.defineProperty(Navigator.prototype, "doNotTrack", { get: () => "1" }));
    if (process.argv.includes("--verbose")) {
      page.on("console", (m) => console.log(`  console: ${m.text()}`));
      page.on("request", (r) => console.log(`  request: ${r.method()} ${r.url().slice(0, 120)}`));
    }
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (!request.url().startsWith(HOST)) return request.continue();
      requests.push(request.url());
      if (request.method() === "POST") events.push(...(await decode(request)));
      await request.respond({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ status: 1 }) });
    });
    for (const path of ["/", "/why/"]) {
      await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle0" });
      if (act) await act(page, path);
      // posthog-js batches; give it time to flush before leaving the page.
      await new Promise((r) => setTimeout(r, 3500));
    }
  } finally {
    await context.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  return { events, requests };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`ok - ${message}`);
}

const copyCreateCommand = async (page, path) => {
  const section = path === "/" ? "#get-started" : "#start";
  await page.click(`${section} .z-codeblock__copy`);
};

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const withKey = await buildSite("phc_analytics_check");

  const tracked = await visit(browser, withKey, { act: copyCreateCommand });
  const names = tracked.events.map((e) => `${e.event} ${new URL(e.properties.$current_url).pathname}`);
  console.log(`events: ${names.join(", ")}`);
  assert(names.includes("$pageview /") && names.includes("$pageview /why/"), "each page sends its pageview");
  const copies = tracked.events.filter((e) => e.event === "install_command_copied");
  assert(copies.length === 2, "the create command's copy button sends install_command_copied on both pages");
  assert(copies.some((e) => e.properties.section === "get-started" && e.properties.template === "marketing"), "the copy names its section and template");
  assert(tracked.events.length > 0 && tracked.events.every((e) => e.properties.app === "ZenginUI"), `every event carries app: "ZenginUI" (${tracked.events.length} events)`);
  assert(tracked.events.every((e) => e.properties.token === "phc_analytics_check"), "events go to the project named by VITE_POSTHOG_KEY");
  if (process.argv.includes("--verbose")) console.log(`  properties: ${[...new Set(tracked.events.flatMap((e) => Object.keys(e.properties)))].sort().join(" ")}`);
  const personal = tracked.events.flatMap((e) => Object.keys(e.properties).filter((k) => /email|^\$?(user_?)?name$|^\$set|^\$ip$|^\$anon_distinct_id$/i.test(k)));
  assert(tracked.events.every((e) => !e.$set && !e.$set_once), "no person properties are set");
  assert(personal.length === 0, `no personal properties (${personal.join(", ") || "none"})`);
  assert(tracked.requests.every((u) => !/\/(flags|decide|array|static)\b/.test(new URL(u).pathname)), "no flags, remote config or scripts are fetched from PostHog");

  const dnt = await visit(browser, withKey, { doNotTrack: true, act: copyCreateCommand });
  assert(dnt.requests.length === 0, "a Do Not Track visitor sends nothing");

  const withoutKey = await buildSite(undefined);
  const silent = await visit(browser, withoutKey, { act: copyCreateCommand });
  assert(silent.requests.length === 0, "a build without VITE_POSTHOG_KEY sends nothing");
} finally {
  await browser.close();
}
