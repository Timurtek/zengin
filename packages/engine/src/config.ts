import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { RuleId, ResolvedConfig, ResolvedProfile, ResolvedRuleConfig, RuleConfig, Severity, ZenginConfig } from "./types.js";
import { RULE_IDS } from "./types.js";

const DEFAULT_INCLUDE = ["src/**/*.{ts,tsx,js,jsx,css}"];
const DEFAULT_EXCLUDE = ["**/*.stories.{ts,tsx}", "**/*.test.{ts,tsx}", "**/node_modules/**"];

export function loadConfigFile(path: string): { config: ZenginConfig; dir: string } {
  const content = readFileSync(path, "utf8");
  const config = parseYaml(content) as ZenginConfig;
  return { config, dir: dirname(resolve(path)) };
}

/**
 * Fills defaults and resolves the system version and definitions directory.
 * `projectDir` is the directory the config lives in; all paths resolve against it.
 */
export function resolveConfig(config: ZenginConfig, projectDir: string): ResolvedConfig {
  if (!config.system?.package) throw new Error("zengin config: system.package is required");
  const pkg = config.system.package;
  const definitionsDir = config.system.definitions
    ? resolve(projectDir, config.system.definitions)
    : join(projectDir, "node_modules", ...pkg.split("/"), "zengin");
  const version = config.system.version ?? readInstalledVersion(projectDir, pkg);
  if (!version) {
    throw new Error(`zengin config: system.version not set and ${pkg} is not installed under ${projectDir}`);
  }

  const rules = Object.fromEntries(RULE_IDS.map((id) => [id, resolveRule(config.rules?.[id])])) as Record<
    RuleId,
    ResolvedRuleConfig
  >;

  return {
    system: {
      package: pkg,
      version,
      sources: config.system.sources ?? [pkg, `${pkg}/*`],
      definitionsDir,
    },
    scope: {
      include: config.scope?.include ?? DEFAULT_INCLUDE,
      exclude: config.scope?.exclude ?? DEFAULT_EXCLUDE,
      foundations: config.scope?.foundations ?? [],
      ownership: config.scope?.ownership ?? [],
    },
    classes: {
      tailwind: resolveTailwind(config.classes?.tailwind ?? "auto", projectDir),
      css: (config.classes?.css ?? []).map((p) => resolve(projectDir, p)),
    },
    rules,
    profiles: readProfiles(config, projectDir),
  };
}

/**
 * `profiles` was briefly called `surfaces`, which collided with the four surfaces the engine reaches you
 * through. A config that still says `surfaces:` is refused by name rather than silently ignored, which would
 * check every file against the base system and look like the feature simply not working.
 */
function readProfiles(config: ZenginConfig, projectDir: string): ResolvedProfile[] {
  if ((config as { surfaces?: unknown }).surfaces) {
    throw new Error("zengin config: `surfaces:` is now `profiles:`. Rename the key; nothing else changed.");
  }
  return (config.profiles ?? []).map((p, i) => {
    if (!p.name) throw new Error(`zengin config: profiles[${i}] has no name`);
    if (!p.include?.length) throw new Error(`zengin config: profile "${p.name}" has no include patterns`);
    return {
      name: p.name,
      include: p.include,
      ...(p.tokens ? { tokensPath: resolve(projectDir, p.tokens) } : {}),
      components: p.components ?? {},
    };
  });
}

/** `auto` enables the Tailwind adapter when the project's package.json depends on tailwindcss. */
function resolveTailwind(setting: "auto" | boolean, projectDir: string): boolean {
  if (setting !== "auto") return setting;
  const p = join(projectDir, "package.json");
  if (!existsSync(p)) return false;
  try {
    const pkg = JSON.parse(readFileSync(p, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return "tailwindcss" in (pkg.dependencies ?? {}) || "tailwindcss" in (pkg.devDependencies ?? {});
  } catch {
    return false;
  }
}

function resolveRule(raw: RuleConfig | Severity | "off" | undefined): ResolvedRuleConfig {
  const base: ResolvedRuleConfig = { enabled: true, severity: "error", allow: "semantic", except: [], map: {} };
  if (raw === undefined) return base;
  if (raw === "off") return { ...base, enabled: false };
  if (typeof raw === "string") return { ...base, severity: raw };
  return {
    enabled: true,
    severity: raw.severity ?? "error",
    allow: raw.allow ?? "semantic",
    except: raw.except ?? [],
    map: raw.map ?? {},
  };
}

function readInstalledVersion(projectDir: string, pkg: string): string | undefined {
  const p = join(projectDir, "node_modules", ...pkg.split("/"), "package.json");
  if (!existsSync(p)) return undefined;
  try {
    return (JSON.parse(readFileSync(p, "utf8")) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

/** Compares two `major.minor.patch` strings. Negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
