// Writes the PostHog project key into the built telemetry module, from ZENGIN_POSTHOG_KEY, at release.
// The key is public by design (it can only send events), but the repository never holds it (docs/analytics.md),
// so the source carries an empty key and a build without the variable sends nothing.
import { readFileSync, writeFileSync } from "node:fs";

const key = process.env.ZENGIN_POSTHOG_KEY;
if (!key) process.exit(0);
if (!/^phc_[A-Za-z0-9]+$/.test(key)) {
  console.error("telemetry-key: ZENGIN_POSTHOG_KEY is not a PostHog project key (phc_...). Nothing written.");
  process.exit(1);
}
const file = process.argv[2] ?? new URL("../dist/telemetry.js", import.meta.url);
const marker = 'const BUILT_IN_KEY = "";';
const source = readFileSync(file, "utf8");
if (!source.includes(marker)) {
  console.error(`telemetry-key: ${marker} not found in ${file}. Nothing written.`);
  process.exit(1);
}
writeFileSync(file, source.replace(marker, `const BUILT_IN_KEY = ${JSON.stringify(key)};`));
