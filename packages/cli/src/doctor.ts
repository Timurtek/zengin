import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { loadConfigFile, resolveConfig, type ComponentManifest } from "@zenginui/engine";
import { AGENT_WIRING, LAYOUT, ZENGIN_VERSIONS, writeTokensCss } from "@zenginui/registry";
import { findConfig } from "./check.js";

export type DoctorLevel = "error" | "warn" | "ok";

export interface DoctorFinding {
  /** Stable identifier, so a report can be talked about: `zengin doctor` prints these. */
  id: string;
  level: DoctorLevel;
  /** What is true, in one line. */
  title: string;
  /** What it costs, for anything that is not obviously bad. */
  detail?: string;
  /** The command or edit that repairs it. */
  fix?: string;
  /** Whether `--fix` repairs it here, or it needs a person. */
  fixable?: boolean;
}

export interface DoctorOptions {
  cwd: string;
  config?: string;
  /** Repair what can be repaired by writing files Zengin itself wrote. */
  fix?: boolean;
}

export interface DoctorResult {
  report: string;
  findings: DoctorFinding[];
  /** Files changed by `--fix`, relative to the project. */
  fixed: string[];
  /** 1 if anything is an error, so CI can run this. */
  exitCode: number;
}

/**
 * `zengin doctor`: is this project's plumbing what this version of Zengin expects?
 *
 * Every other command answers a question about the code. This one answers a question about the project
 * itself, and it exists because of a fault the other commands cannot see: a project is wired to Zengin once,
 * when it is created, and never again. `zengin upgrade` carries the owned components forward; the agent
 * wiring, the version pins and the generated files are create-time artifacts with no upgrade path at all. So
 * a project scaffolded before a fix keeps that fault for as long as it lives, and nothing tells it.
 *
 * That is not hypothetical. Projects created before 0.4.0 wrote the MCP server and the edit hook as bare
 * binaries that an agent cannot launch, so their enforcement loop never ran — and the loop failing is
 * indistinguishable, from the inside, from a project that simply never drifts. The first report of it came
 * from a session that had been building against a design system for a day with the hook silently dead.
 *
 * Every check here is local: no network, no clock, same answer every time. Component drift against the
 * registry is `zengin upgrade`'s question and is deliberately left there.
 */
export function runDoctor(opts: DoctorOptions): DoctorResult {
  const first = diagnose(opts.cwd, opts.config, opts.fix === true);
  // Repairing and then reporting what was wrong before the repair leaves a green project looking red, and a
  // `--fix` in CI failing on faults it just fixed. So when anything was written, the report is a second look.
  const after = first.fixed.length ? diagnose(opts.cwd, opts.config, false) : first;
  const errors = after.findings.filter((f) => f.level === "error").length;
  return { report: render(after.findings, first.fixed, opts.fix === true), findings: after.findings, fixed: first.fixed, exitCode: errors ? 1 : 0 };
}

function diagnose(cwd: string, config: string | undefined, fix: boolean): { findings: DoctorFinding[]; fixed: string[] } {
  const findings: DoctorFinding[] = [];
  const fixed: string[] = [];

  const configPath = findConfig(config, cwd);
  const projectDir = dirname(configPath);
  const at = (rel: string): string => join(projectDir, rel);
  const rel = (path: string): string => relative(projectDir, path).replace(/\\/g, "/");

  // The config has to load before anything else can be judged against it. A config this version refuses —
  // `surfaces:` from before the rename, say — is a finding rather than a crash: that is the whole point.
  let resolved: ReturnType<typeof resolveConfig> | undefined;
  try {
    const { config: parsed, dir } = loadConfigFile(configPath);
    resolved = resolveConfig(parsed, dir);
    findings.push({ id: "config", level: "ok", title: `Config at ${rel(configPath)}, system ${resolved.system.package}@${resolved.system.version}.` });
  } catch (e) {
    findings.push({
      id: "config",
      level: "error",
      title: `${rel(configPath)} cannot be read by this version.`,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const wiring = {
    "@zenginui/mcp": checkMcp(at, rel, findings, fix, fixed),
    "@zenginui/hook": checkHook(at, rel, findings, fix, fixed),
  };
  checkPins(at, findings, wiring);
  if (resolved) {
    checkDefinitions(resolved, at, rel, findings, fix, fixed);
    checkWiringOfComponents(resolved, at, rel, findings, fix, fixed);
  }
  return { findings, fixed };
}

/* ------------------------------------------------------------------ the agent surfaces */

interface McpFile {
  mcpServers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
}

/**
 * Where an agent session actually reads this file from: the project, or a directory above it up to the
 * repository root. A package in a monorepo is usually opened at the root, and its wiring lives there.
 */
function findUp(projectDir: string, name: string): string | undefined {
  let dir = projectDir;
  for (;;) {
    if (existsSync(join(dir, name))) return join(dir, name);
    if (existsSync(join(dir, ".git"))) return undefined;
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

function checkMcp(at: (r: string) => string, rel: (p: string) => string, out: DoctorFinding[], fix: boolean, fixed: string[]): boolean {
  const path = findUp(at("."), ".mcp.json") ?? at(".mcp.json");
  if (!existsSync(path)) {
    out.push({
      id: "mcp-missing",
      level: "warn",
      title: "No .mcp.json, so an agent session has no way to ask the engine anything.",
      detail: "Fine for a project no agent works in. In one where an agent does, this is the surface it asks through.",
      fix: `Write one: the "${AGENT_WIRING.server}" server runs \`${AGENT_WIRING.command} ${AGENT_WIRING.args.join(" ")}\`.`,
      fixable: true,
    });
    if (fix) fixed.push(writeMcp(path, {}));
    return fix;
  }

  const file = readJson<McpFile>(path);
  if (!file) {
    out.push({ id: "mcp-unreadable", level: "error", title: `${rel(path)} is not valid JSON.`, fix: "Fix the JSON by hand; this one is not safe to rewrite." });
    return true;
  }

  const server = file.mcpServers?.[AGENT_WIRING.server];
  if (!server) {
    out.push({
      id: "mcp-server",
      level: "warn",
      title: `.mcp.json has no "${AGENT_WIRING.server}" server, so the engine is not reachable from an agent session.`,
      fix: "zengin doctor --fix adds it beside whatever else is there.",
      fixable: true,
    });
    if (fix) fixed.push(writeMcp(path, file));
    return fix;
  }

  const command = [server.command ?? "", ...(server.args ?? [])].join(" ").trim();
  const wanted = [AGENT_WIRING.command, ...AGENT_WIRING.args].join(" ");
  if (server.command === "zengin-mcp") {
    out.push({
      id: "mcp-bare-binary",
      level: "error",
      title: "The MCP server is the bare `zengin-mcp` binary, which an agent cannot launch.",
      detail: "It lives in node_modules/.bin, which is on PATH inside an npm script and nowhere else. The server never starts and nothing says so.",
      fix: `Use \`${wanted}\`.`,
      fixable: true,
    });
    if (fix) fixed.push(writeMcp(path, file));
  } else if (command !== wanted) {
    const unguarded = server.command === AGENT_WIRING.command && !(server.args ?? []).includes("--no-install");
    out.push({
      id: "mcp-command",
      level: "warn",
      title: `The MCP server runs \`${command}\`, not \`${wanted}\`.`,
      detail: unguarded
        ? "Without --no-install, npx may fetch a copy from the network instead of the version this project pins."
        : "A deliberate command is fine — the monorepo's own examples point straight at a build. This only says it differs from what `create` writes.",
      fix: `zengin doctor --fix sets it to \`${wanted}\`.`,
      fixable: true,
    });
    if (fix) fixed.push(writeMcp(path, file));
  } else {
    out.push({ id: "mcp", level: "ok", title: `MCP server wired in ${rel(path) || ".mcp.json"}: \`${wanted}\`.` });
  }

  const configured = server.env?.[AGENT_WIRING.configEnv];
  if (configured && !existsSync(at(configured))) {
    out.push({
      id: "mcp-config-env",
      level: "error",
      title: `.mcp.json points ${AGENT_WIRING.configEnv} at ${configured}, which does not exist.`,
      fix: `Set it to ${AGENT_WIRING.configFile}.`,
    });
  }
  return true;
}

function writeMcp(path: string, file: McpFile): string {
  const next: McpFile = {
    ...file,
    mcpServers: {
      ...file.mcpServers,
      [AGENT_WIRING.server]: { command: AGENT_WIRING.command, args: [...AGENT_WIRING.args], env: { [AGENT_WIRING.configEnv]: AGENT_WIRING.configFile } },
    },
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return ".mcp.json";
}

interface SettingsFile {
  hooks?: { PostToolUse?: { matcher?: string; hooks?: { type?: string; command?: string; timeout?: number; statusMessage?: string }[] }[] };
}

const HOOK_PATH = ".claude/settings.json";

function checkHook(at: (r: string) => string, rel: (p: string) => string, out: DoctorFinding[], fix: boolean, fixed: string[]): boolean {
  const path = findUp(at("."), HOOK_PATH) ?? at(HOOK_PATH);
  const file = existsSync(path) ? readJson<SettingsFile>(path) : {};
  if (!file) {
    out.push({ id: "hook-unreadable", level: "error", title: `${rel(path)} is not valid JSON.`, fix: "Fix the JSON by hand; this one is not safe to rewrite." });
    return true;
  }

  const entries = file.hooks?.PostToolUse ?? [];
  const commands = entries.flatMap((e) => (e.hooks ?? []).map((h) => h.command ?? ""));
  const zengin = commands.filter((c) => c.includes("zengin-hook"));

  if (!zengin.length) {
    out.push({
      id: "hook-missing",
      level: "warn",
      title: "No PostToolUse hook runs zengin-hook, so edits are never checked as they are written.",
      detail: "The MCP server answers when asked. The hook is the half that holds an agent to the system without being asked.",
      fix: `zengin doctor --fix adds it: \`${AGENT_WIRING.hookCommand}\` on ${AGENT_WIRING.hookMatcher}.`,
      fixable: true,
    });
    if (fix) fixed.push(writeHook(path, file));
    return fix;
  }

  const bare = zengin.find((c) => c.trim() === "zengin-hook");
  if (bare) {
    out.push({
      id: "hook-bare-binary",
      level: "error",
      title: "The edit hook is the bare `zengin-hook` binary, which never runs.",
      detail:
        "It lives in node_modules/.bin, which is on PATH inside an npm script and nowhere else. The hook fails to start and the failure is silent, so the project looks compliant because nothing is checking it.",
      fix: `Use \`${AGENT_WIRING.hookCommand}\`.`,
      fixable: true,
    });
    if (fix) fixed.push(writeHook(path, file));
    return true;
  }

  const exact = zengin.some((c) => c.trim() === AGENT_WIRING.hookCommand);
  if (!exact) {
    out.push({
      id: "hook-command",
      level: "warn",
      title: `The edit hook runs \`${zengin[0]}\`, not \`${AGENT_WIRING.hookCommand}\`.`,
      detail: "Without --no-install, npx may fetch a copy from the network instead of using the version this project pins.",
      fix: "zengin doctor --fix sets it.",
      fixable: true,
    });
    if (fix) fixed.push(writeHook(path, file));
    return true;
  }

  const matcher = entries.find((e) => (e.hooks ?? []).some((h) => (h.command ?? "").includes("zengin-hook")))?.matcher ?? "";
  for (const tool of AGENT_WIRING.hookMatcher.split("|")) {
    if (!matcher.includes(tool)) {
      out.push({
        id: "hook-matcher",
        level: "warn",
        title: `The hook's matcher (${matcher || "empty"}) does not cover ${tool}, so those edits go unchecked.`,
        fix: `Matcher: ${AGENT_WIRING.hookMatcher}.`,
      });
      break;
    }
  }
  out.push({ id: "hook", level: "ok", title: `Edit hook wired in ${rel(path) || HOOK_PATH}: \`${AGENT_WIRING.hookCommand}\` on ${matcher || AGENT_WIRING.hookMatcher}.` });
  return true;
}

function writeHook(path: string, file: SettingsFile): string {
  const others = (file.hooks?.PostToolUse ?? []).filter((e) => !(e.hooks ?? []).some((h) => (h.command ?? "").includes("zengin-hook")));
  const next: SettingsFile = {
    ...file,
    hooks: {
      ...file.hooks,
      PostToolUse: [
        ...others,
        {
          matcher: AGENT_WIRING.hookMatcher,
          hooks: [{ type: "command", command: AGENT_WIRING.hookCommand, timeout: 30, statusMessage: "Checking against the design system..." }],
        },
      ],
    },
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return HOOK_PATH;
}

/* ------------------------------------------------------------------ versions */

/**
 * Judged against what a project created by this generation of Zengin would pin, which is the same generated
 * map `create` writes — so doctor cannot drift from create even in principle. The running CLI's own version
 * is not the measure: the hook and the MCP server have their own version lines.
 */
function checkPins(at: (r: string) => string, out: DoctorFinding[], wired: Record<string, boolean | undefined>): void {
  const pkgPath = at("package.json");
  const pkg = existsSync(pkgPath) ? readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(pkgPath) : undefined;
  if (!pkg) return;
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, current] of Object.entries(ZENGIN_VERSIONS)) {
    const range = declared[name];
    if (!range) {
      // A surface this project does not wire is a surface it does not need the package for. The CLI is the
      // exception: something ran this command, and a project that cannot run it in CI is worth a word.
      const needed = wired[name] ?? name === "@zenginui/cli";
      if (needed && !installedVersion(at, name)) {
        out.push({
          id: `pin-${short(name)}-missing`,
          level: "warn",
          title: `${name} is wired but is not a dependency of this project, so nothing guarantees it is there.`,
          fix: `npm install -D ${name}@${current}`,
        });
      }
      continue;
    }
    if (range === current) continue;

    // Only the ranges npm writes are judged. An exotic one, or a link: to a checkout, is deliberate.
    const wanted = current.replace(/^[~^]/, "");
    if (admits(range, wanted) === false) {
      const installed = installedVersion(at, name);
      out.push({
        id: `pin-${short(name)}`,
        level: "warn",
        title: `${name} is pinned ${range}${installed ? `, so ${installed} is installed` : ""}; this Zengin pins ${current}.`,
        detail:
          "A pin is written when a project is created and never revisited, so a project keeps the tooling it was born with, and commands and flags added since do not exist inside it.",
        fix: `npm install -D ${name}@${current}`,
      });
    }
  }
}

function short(name: string): string {
  return name.split("/")[1] ?? name;
}

function installedVersion(at: (r: string) => string, name: string): string | undefined {
  const p = at(join("node_modules", ...name.split("/"), "package.json"));
  return existsSync(p) ? readJson<{ version?: string }>(p)?.version : undefined;
}

/**
 * Does `range` admit `version`? Only the forms npm writes are answered; anything else returns undefined,
 * because a wrong "your pin is stale" is worse than no answer.
 */
export function admits(range: string, version: string): boolean | undefined {
  const v = parse(version);
  if (!v) return undefined;
  const m = /^([~^]?)(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (!m) return undefined;
  const [, op, major, minor, patch] = m;
  const r = [Number(major), Number(minor), Number(patch)] as const;
  if (cmp(v, r) < 0) return false;
  if (op === "^") return r[0] === 0 ? v[0] === 0 && v[1] === r[1] : v[0] === r[0];
  if (op === "~") return v[0] === r[0] && v[1] === r[1];
  return cmp(v, r) === 0;
}

function parse(v: string): readonly [number, number, number] | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

function cmp(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/* ------------------------------------------------------------------ definitions and generated files */

function checkDefinitions(
  resolved: ReturnType<typeof resolveConfig>,
  at: (r: string) => string,
  rel: (p: string) => string,
  out: DoctorFinding[],
  fix: boolean,
  fixed: string[],
): void {
  const defs = resolved.system.definitionsDir;
  const manifestPath = join(defs, "components.json");
  const tokensPath = join(defs, "tokens.json");

  for (const [label, path] of [
    ["tokens.json", tokensPath],
    ["components.json", manifestPath],
  ] as const) {
    if (!existsSync(path)) {
      out.push({
        id: `definitions-${label.replace(".json", "")}`,
        level: "error",
        title: `No ${rel(path)}: the engine has nothing to enforce against.`,
        fix: label === "tokens.json" ? "zengin init, or copy the file back from version control." : "zengin define --write",
      });
      continue;
    }
    if (!readJson<unknown>(path)) out.push({ id: `definitions-${label}`, level: "error", title: `${rel(path)} is not valid JSON.` });
  }

  // Generated CSS: the app renders unstyled without it, and stale means the tokens file moved on without it.
  // Only for a project that generates its own: an app consuming a published system imports that package's
  // stylesheet instead, and has no generated file to be missing.
  const generated = at(join("src", "styles", "generated", "tokens.css"));
  const stylesIndex = at(LAYOUT.stylesIndex);
  const generatesOwnTokens = existsSync(stylesIndex) && readFileSync(stylesIndex, "utf8").includes("generated/tokens.css");
  if (generatesOwnTokens && existsSync(tokensPath)) {
    if (!existsSync(generated)) {
      out.push({
        id: "tokens-css",
        level: "error",
        title: "src/styles/generated/tokens.css is missing, so every custom property the components use is undefined.",
        fix: "zengin tokens",
        fixable: true,
      });
      if (fix) {
        writeTokensCss(defs, generated);
        fixed.push("src/styles/generated/tokens.css");
      }
    } else if (statSync(tokensPath).mtimeMs > statSync(generated).mtimeMs) {
      out.push({
        id: "tokens-css-stale",
        level: "warn",
        title: "src/styles/generated/tokens.css is older than zengin/tokens.json.",
        detail: "A token added or changed since the last build is not in the stylesheet, so it resolves to nothing at runtime.",
        fix: "zengin tokens",
        fixable: true,
      });
      if (fix) {
        writeTokensCss(defs, generated);
        fixed.push("src/styles/generated/tokens.css");
      }
    }
  }
}

/**
 * Every component on disk should be three things at once: a directory, a manifest entry, and a line in both
 * the barrel and the stylesheet index. `install` writes all four; a hand-made component or a hand-edited
 * index drifts, and each kind of drift fails differently — an unlisted component is unenforced, an unimported
 * stylesheet renders wrong, a missing barrel line breaks the import someone will write next.
 */
function checkWiringOfComponents(
  resolved: ReturnType<typeof resolveConfig>,
  at: (r: string) => string,
  rel: (p: string) => string,
  out: DoctorFinding[],
  fix: boolean,
  fixed: string[],
): void {
  const dir = at(LAYOUT.componentsDir);
  if (!existsSync(dir)) return;
  const dirs = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (!dirs.length) return;

  const manifestPath = join(resolved.system.definitionsDir, "components.json");
  const manifest = existsSync(manifestPath) ? (readJson<ComponentManifest[]>(manifestPath) ?? []) : [];
  const known = new Set(manifest.map((m) => kebabOf(m.name)));
  const undefinedComponents = dirs.filter((d) => !known.has(d));
  if (undefinedComponents.length) {
    out.push({
      id: "undefined-components",
      level: "warn",
      title: `${undefinedComponents.length} component${undefinedComponents.length === 1 ? "" : "s"} on disk ${undefinedComponents.length === 1 ? "is" : "are"} not in the manifest: ${undefinedComponents.join(", ")}.`,
      detail: "A component the manifest does not know is a component nobody is held to: a misspelled prop or an invented variant passes.",
      fix: "zengin define --write",
    });
  }

  const barrelPath = join(dir, "index.ts");
  const barrel = existsSync(barrelPath) ? readFileSync(barrelPath, "utf8") : "";
  const stylesPath = at(LAYOUT.stylesIndex);
  const styles = existsSync(stylesPath) ? readFileSync(stylesPath, "utf8") : "";

  const missingStyles: string[] = [];
  const missingBarrel: string[] = [];
  for (const name of dirs) {
    if (existsSync(join(dir, name, `${name}.css`)) && !styles.includes(`${name}/${name}.css`)) missingStyles.push(name);
    if (existsSync(join(dir, name, `${name}.tsx`)) && !barrel.includes(`./${name}/${name}`)) missingBarrel.push(name);
  }

  if (missingStyles.length) {
    out.push({
      id: "stylesheet-imports",
      level: "error",
      title: `${missingStyles.join(", ")}: stylesheet${missingStyles.length === 1 ? "" : "s"} not imported by ${LAYOUT.stylesIndex}, so ${missingStyles.length === 1 ? "it renders" : "they render"} unstyled.`,
      fix: `Add @import "../components/ui/<name>/<name>.css";`,
      fixable: true,
    });
    if (fix && existsSync(stylesPath)) {
      const added = missingStyles.map((n) => `@import "../components/ui/${n}/${n}.css";`).join("\n");
      writeFileSync(stylesPath, `${styles.trimEnd()}\n${added}\n`);
      fixed.push(LAYOUT.stylesIndex);
    }
  }
  if (missingBarrel.length) {
    out.push({
      id: "barrel-exports",
      level: "warn",
      title: `${missingBarrel.join(", ")}: not exported from ${LAYOUT.componentsDir}/index.ts.`,
      detail: "Imports from the alias will not resolve, and the engine reads the barrel to know what the system exports.",
      fix: `Add export * from "./<name>/<name>";`,
      fixable: true,
    });
    if (fix && existsSync(barrelPath)) {
      const added = missingBarrel.map((n) => `export * from "./${n}/${n}";`).join("\n");
      writeFileSync(barrelPath, `${barrel.trimEnd()}\n${added}\n`);
      fixed.push(`${LAYOUT.componentsDir}/index.ts`);
    }
  }
}

function kebabOf(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/* ------------------------------------------------------------------ plumbing */

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return undefined;
  }
}

const useColor = (): boolean => process.stdout.isTTY === true && !process.env["NO_COLOR"] && process.env["TERM"] !== "dumb";
const paint =
  (code: string) =>
  (s: string): string =>
    useColor() ? `[${code}m${s}[0m` : s;
const red = paint("31");
const yellow = paint("33");
const green = paint("32");
const dim = paint("2");

const MARK: Record<DoctorLevel, (s: string) => string> = { error: red, warn: yellow, ok: green };
const GLYPH: Record<DoctorLevel, string> = { error: "×", warn: "!", ok: "✓" };

function render(findings: DoctorFinding[], fixed: string[], fix: boolean): string {
  const lines: string[] = [];
  for (const f of findings) {
    lines.push(`${MARK[f.level](GLYPH[f.level])} ${f.title}`);
    if (f.detail) lines.push(`  ${dim(f.detail)}`);
    if (f.fix && f.level !== "ok") lines.push(`  ${dim("fix")}  ${f.fix}`);
  }

  const errors = findings.filter((f) => f.level === "error").length;
  const warns = findings.filter((f) => f.level === "warn").length;
  lines.push("");
  if (fixed.length) lines.push(`Repaired: ${[...new Set(fixed)].join(", ")}.`, "");

  const tail =
    errors || warns
      ? `${errors} error${errors === 1 ? "" : "s"}, ${warns} warning${warns === 1 ? "" : "s"}.`
      : "Everything this command knows how to check is in order.";
  lines.push(errors ? red(tail) : warns ? yellow(tail) : green(tail));

  const fixable = findings.some((f) => f.fixable && f.level !== "ok");
  if (fixable && !fix) lines.push(dim("zengin doctor --fix repairs the ones it can: the files Zengin itself writes."));
  if (fixed.length) lines.push(dim("The MCP server and the hook are read when an agent session starts. Open a new session for these to take effect."));
  if (errors || warns) lines.push(dim("Component drift against the registry is a different question: zengin upgrade."));
  return lines.join("\n");
}
