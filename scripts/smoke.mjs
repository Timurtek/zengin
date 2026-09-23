#!/usr/bin/env node
/**
 * What a visitor actually gets, checked against a running deployment.
 *
 *   node scripts/smoke.mjs                          # https://zengin.timurtek.com
 *   node scripts/smoke.mjs http://localhost:5174    # a dev server or a preview deployment
 *
 * This exists because two hosting bugs shipped green on the same day. The engine, the tests and CI all pass
 * on a site whose Storybook link is dead, because nothing else in the pipeline opens a URL. Both bugs were
 * Vercel rewriting a path: `/storybook` lost its trailing slash, and later `cleanUrls` turned
 * `/storybook/iframe.html` into `/storybook/iframe/`, one directory deeper than the file it served, so every
 * relative asset inside resolved into a directory that does not exist.
 *
 * So a status code is not the test. The test is that each page answers at the URL the navigation points at,
 * without being redirected somewhere its own relative links stop working, and that the assets the served
 * HTML actually asks for are really there. The asset list is read out of each page rather than written down
 * here, which is what makes this catch the next bug of this shape instead of only the last two.
 */

const BASE = (process.argv[2] ?? "https://zengin.timurtek.com").replace(/\/$/, "");
const TIMEOUT_MS = 20_000;

/** Pages the site's own navigation promises, and the JSON other software depends on. */
const PAGES = [
  // Match the stable half of the title, not the whole of it: the exact wording is copy, and a check that
  // fails when someone improves a headline teaches people to ignore the check.
  { path: "/", expect: "<title>Zengin", why: "the marketing page" },
  { path: "/why/", expect: "Why Zengin", why: "the positioning page, first in the nav" },
  { path: "/robots.txt", expect: "Sitemap:", why: "what a crawler reads first" },
  { path: "/sitemap.xml", expect: "zengin.timurtek.com/why/", why: "the sitemap, and that the why page is in it" },
  { path: "/docs/", expect: "Zengin docs", why: "the documentation, linked from the nav" },
  { path: "/rollup/", expect: "rollup", why: "the hosted trends, linked from the nav" },
  { path: "/storybook/", expect: "Storybook", why: "the Storybook manager, linked from the nav" },
  // The file every story renders inside. It must answer at this exact URL: a redirect that adds a slash
  // moves the page one directory deeper and silently breaks every relative asset in it.
  { path: "/storybook/iframe.html", expect: "vite-inject-mocker-entry", why: "the Storybook preview frame", exact: true },
];

const TEMPLATES = ["blank", "marketing", "review", "saas", "chat", "auth", "docs", "storefront"];
for (const name of TEMPLATES) {
  PAGES.push({ path: `/templates/${name}/`, expect: "<div id=\"root\">", why: `the ${name} template preview`, assets: 4 });
}

/** JSON other software reads. The registry is the distribution channel, not a page. */
const FEEDS = [
  { path: "/r/index.json", why: "the public registry, which zengin create and add read", check: (d) => Array.isArray(d.items) && d.items.length > 0, describe: (d) => `${d.items.length} items` },
  { path: "/storybook/index.json", why: "the Storybook story index", check: (d) => Object.keys(d.entries ?? {}).length > 0, describe: (d) => `${Object.keys(d.entries).length} entries` },
];

const failures = [];
const notes = [];

function fail(what, detail) {
  failures.push(`${what}\n      ${detail}`);
}

async function get(url, { redirect = "follow" } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { redirect, signal: controller.signal, headers: { "user-agent": "zengin-smoke" } });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The assets a page asks for, in its own words: `src="./x"`, `href="/assets/y"`. Only other hosts are
 * skipped, since a CDN being up is not this test's business. Both relative and root-relative references are
 * fetched, because either can go missing in a build and only one of them can be broken by a base-path change.
 */
function relativeAssets(html, limit) {
  const out = new Set();
  for (const m of html.matchAll(/\b(?:src|href)="(?!https?:|\/\/|#|data:|mailto:)([^"]+)"/g)) {
    const ref = m[1];
    if (!/\.(js|mjs|css|svg|png|woff2?|json)$/.test(ref)) continue;
    out.add(ref);
    if (out.size >= limit) break;
  }
  return [...out];
}

async function checkPage({ path, expect, why, exact = false, assets = 6 }) {
  const url = BASE + path;
  let res;
  try {
    res = await get(url, { redirect: exact ? "manual" : "follow" });
  } catch (e) {
    return fail(`${path} (${why})`, `request failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (exact && res.status >= 300 && res.status < 400) {
    return fail(`${path} (${why})`, `redirected to ${res.headers.get("location")}. A page whose assets are relative must answer at its own URL.`);
  }
  if (!res.ok) return fail(`${path} (${why})`, `HTTP ${res.status}`);

  const landed = new URL(res.url || url);
  if (!exact && landed.pathname !== path) notes.push(`${path} redirected to ${landed.pathname}`);

  const html = await res.text();
  if (!html.includes(expect)) {
    return fail(`${path} (${why})`, `answered ${res.status} but the body does not contain ${JSON.stringify(expect)}. Something else is being served here, most likely a fallback page.`);
  }

  // The assets this page actually asks for, resolved the way a browser would resolve them.
  const refs = relativeAssets(html, assets);
  const broken = [];
  await Promise.all(
    refs.map(async (ref) => {
      const assetUrl = new URL(ref, landed).toString();
      try {
        const r = await get(assetUrl, { redirect: "manual" });
        if (r.status >= 300 && r.status < 400) broken.push(`${ref} -> ${r.status} ${r.headers.get("location")}`);
        else if (!r.ok) broken.push(`${ref} -> HTTP ${r.status}`);
      } catch (e) {
        broken.push(`${ref} -> ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );
  if (broken.length) {
    return fail(`${path} (${why})`, `the page loads but ${broken.length} of its own ${refs.length} assets do not:\n      ${broken.join("\n      ")}`);
  }

  console.log(`  ok  ${path}  ${refs.length ? `+ ${refs.length} assets` : ""}`);
}

async function checkFeed({ path, why, check, describe }) {
  const url = BASE + path;
  let res;
  try {
    res = await get(url);
  } catch (e) {
    return fail(`${path} (${why})`, `request failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) return fail(`${path} (${why})`, `HTTP ${res.status}`);
  let data;
  try {
    data = await res.json();
  } catch {
    return fail(`${path} (${why})`, "answered 200 but the body is not JSON. A page is being served where a feed should be.");
  }
  if (!check(data)) return fail(`${path} (${why})`, "the JSON parsed but is empty or the wrong shape.");
  console.log(`  ok  ${path}  ${describe(data)}`);
}

console.log(`Smoke test against ${BASE}\n`);
for (const page of PAGES) await checkPage(page);
for (const feed of FEEDS) await checkFeed(feed);

if (notes.length) {
  console.log("\nRedirects followed (allowed, but worth knowing):");
  for (const n of notes) console.log(`  ${n}`);
}

if (failures.length) {
  console.error(`\n${failures.length} ${failures.length === 1 ? "check" : "checks"} failed:\n`);
  for (const f of failures) console.error(`  x  ${f}\n`);
  process.exit(1);
}

console.log(`\nAll ${PAGES.length + FEEDS.length} checks passed.`);
