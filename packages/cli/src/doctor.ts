import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { loadConfigFile, resolveConfig, type ComponentManifest } from "@zenginui/engine";
import { AGENT_WIRING, LAYOUT, ZENGIN_VERSIONS, varsUsed, writeTokensCss } from "@zenginui/registry";
import { loadTokens } from "@zenginui/engine";
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
  /** The checks that ran, named, so a clean report says what it looked at. */
  checked: string[];
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
  return {
    report: render(after.findings, first.fixed, opts.fix === true, after.checked),
    findings: after.findings,
    checked: after.checked,
    fixed: first.fixed,
    exitCode: errors ? 1 : 0,
  };
}

function diagnose(cwd: string, config: string | undefined, fix: boolean): { findings: DoctorFinding[]; fixed: string[]; checked: string[] } {
  const findings: DoctorFinding[] = [];
  const fixed: string[] = [];
  const checked: string[] = [];

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
  checked.push("agent wiring");
  checkRootedness(at, rel, findings);
  checked.push("session rootedness");
  checkPins(at, findings, wiring);
  checked.push("version pins");
  if (resolved) {
    checkDefinitions(resolved, at, rel, findings, fix, fixed);
    checked.push("definitions", "generated stylesheet");
    checkWiringOfComponents(resolved, at, rel, findings, fix, fixed);
    checked.push("component wiring");
    checkTokensComponentsNeed(resolved, at, findings);
    checked.push("tokens the components read");
  }
  return { findings, fixed, checked };
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

/**
 * Is this command a path to a build that exists? A repository working on Zengin itself wires the agent to its
 * own `dist`, which is deliberate and correct, and telling that from a bare binary that cannot launch is the
 * difference between a useful warning and a nagging one.
 */
function localBuild(dir: string, parts: string[]): string | undefined {
  if (parts[0] !== "node" || !parts[1]) return undefined;
  const target = join(dir, parts[1]);
  return existsSync(target) ? parts[1] : undefined;
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
  } else if (localBuild(dirname(path), [server.command ?? "", ...(server.args ?? [])])) {
    out.push({ id: "mcp", level: "ok", title: `MCP server wired to a local build: \`${command}\`.` });
    checkConfigEnv(server, path, out);
    return false;
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

  checkConfigEnv(server, path, out);
  return true;
}

/** The config the server is told to read. Relative to the file that declares it, which in a monorepo is the
 * repository root rather than this project. */
function checkConfigEnv(server: { env?: Record<string, string> }, path: string, out: DoctorFinding[]): void {
  const configured = server.env?.[AGENT_WIRING.configEnv];
  if (configured && !existsSync(join(dirname(path), configured))) {
    out.push({
      id: "mcp-config-env",
      level: "error",
      title: `.mcp.json points ${AGENT_WIRING.configEnv} at ${configured}, which does not exist.`,
      fix: `Set it to a config that does, or drop it: without it the server reads the nearest one above its working directory.`,
    });
  }
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

interface HookEntry {
  type?: string;
  command?: string;
  /** Not part of the hook schema. Present only in a file someone wrote by hand, and the reason to look. */
  args?: string[];
  timeout?: number;
  statusMessage?: string;
}

interface SettingsFile {
  hooks?: { PostToolUse?: { matcher?: string; hooks?: HookEntry[] }[] };
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
  const all = entries.flatMap((e) => e.hooks ?? []);
  const mentionsZengin = (h: HookEntry): boolean => [h.command ?? "", ...(h.args ?? [])].some((p) => p.includes("zengin-hook") || /hook[\\/]dist/.test(p));

  // A hook declared as a command plus an args array never runs: the schema has one string field, so the
  // command is `node` and the path is dropped. It fails the way every fault in this family fails — silently.
  const split = all.find((h) => h.args?.length && mentionsZengin(h));
  if (split) {
    const whole = [split.command ?? "", ...(split.args ?? [])].join(" ").trim();
    out.push({
      id: "hook-split-args",
      level: "error",
      title: "The edit hook is declared with a separate `args` array, which the hook schema does not have, so it never runs.",
      detail: `Only \`command\` is read, so the command is \`${split.command ?? ""}\` with the rest dropped.`,
      fix: `Put the whole thing in command: \`${whole}\`.`,
      fixable: true,
    });
    if (fix) {
      split.command = whole;
      delete split.args;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
      fixed.push(rel(path));
    }
    return false;
  }

  const commands = all.map((h) => h.command ?? "");
  const zengin = commands.filter((c) => c.includes("zengin-hook") || /hook[\\/]dist/.test(c));

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

  const build = zengin.map((c) => localBuild(dirname(path).replace(/[\\/]\.claude$/, ""), c.trim().split(/\s+/))).find(Boolean);
  const exact = zengin.some((c) => c.trim() === AGENT_WIRING.hookCommand);
  if (build) {
    out.push({ id: "hook", level: "ok", title: `Edit hook wired to a local build: \`${zengin[0]}\`.` });
    return false;
  }
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

  const entry = entries.find((e) => (e.hooks ?? []).some((h) => (h.command ?? "").includes("zengin-hook")));
  const matcher = entry?.matcher ?? "";
  const uncovered = AGENT_WIRING.hookMatcher.split("|").filter((tool) => !matcher.includes(tool));
  if (uncovered.length) {
    out.push({
      id: "hook-matcher",
      level: "warn",
      title: `The hook's matcher (${matcher || "empty"}) does not cover ${uncovered.join(", ")}, so those edits go unchecked.`,
      detail: uncovered.includes("Bash") ? "An agent that edits through the shell never reaches the hook, and nothing says so." : undefined,
      fix: `Matcher: ${AGENT_WIRING.hookMatcher}.`,
      // The matcher lives in a file Zengin writes, which is the line --fix draws.
      fixable: true,
    });
    if (fix && entry) {
      entry.matcher = AGENT_WIRING.hookMatcher;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
      fixed.push(rel(path));
    }
    return true;
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

/**
 * A correct wiring file that no session will ever read.
 *
 * `.mcp.json` and `.claude/settings.json` are read from the directory a session is opened in. When the app is
 * a subdirectory of a larger repository — common, and the shape that made this visible — the files sit in the
 * app and the sessions open at the repository root, so the server never starts and the hook never fires while
 * every file involved is valid. Validating the file is not the same as checking that anything reads it.
 */
function checkRootedness(at: (r: string) => string, rel: (p: string) => string, out: DoctorFinding[]): void {
  const projectDir = at(".");
  const wiring = existsSync(at(HOOK_PATH)) ? at(HOOK_PATH) : existsSync(at(".mcp.json")) ? at(".mcp.json") : undefined;
  if (!wiring) return; // nothing to be rooted wrongly; the missing-file findings cover it

  let dir = projectDir;
  for (;;) {
    if (existsSync(join(dir, ".git"))) break;
    const up = dirname(dir);
    if (up === dir) return; // not in a repository: nothing to compare against
    dir = up;
  }
  if (resolve(dir) === resolve(projectDir)) return;

  out.push({
    id: "session-rootedness",
    level: "warn",
    title: `The wiring is in this directory, but the repository root is ${dir}.`,
    detail:
      "An agent session reads .mcp.json and the hook from the directory it is opened in. A session opened at the repository root will not see these files, and nothing will say so: the server does not start and the hook does not fire.",
    fix: "Open sessions in this directory, or copy the wiring to the repository root.",
  });
}

/**
 * Custom properties the project's own components read that its definitions do not define.
 *
 * This is the project-level half of what `token-reference` reports per file, and it is here because the
 * cause is a project fact rather than a code mistake: a component added from the registry can read a token
 * family added after the project was created. It is the finding that made `doctor` look healthy while
 * `check` exited 1.
 */
function checkTokensComponentsNeed(resolved: ReturnType<typeof resolveConfig>, at: (r: string) => string, out: DoctorFinding[]): void {
  const tokensPath = join(resolved.system.definitionsDir, "tokens.json");
  const componentsDir = at(LAYOUT.componentsDir);
  if (!existsSync(tokensPath) || !existsSync(componentsDir)) return;

  let defined: Set<string>;
  try {
    defined = new Set(loadTokens(JSON.parse(readFileSync(tokensPath, "utf8"))).map((t) => t.cssVar));
  } catch {
    return; // an unreadable tokens.json is already an error from checkDefinitions
  }

  const styles: string[] = [];
  const declared = new Set<string>();
  for (const p of cssUnder(componentsDir).concat(cssUnder(at(join("src", "styles"))), cssUnder(at(join("src", "theme"))))) {
    const content = readFileSync(p, "utf8");
    if (p.startsWith(componentsDir)) styles.push(content);
    for (const m of content.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(m[1]!);
  }
  if (!styles.length) return;

  // The same allowance `token-reference` makes, from the same list: a property a dependency sets at runtime
  // is defined nowhere on purpose. Without this the check reports every --radix-* property as broken, which
  // is the exact false positive the rule was taught to avoid when it was widened.
  const external = (v: string): boolean => {
    const name = v.replace(/^--/, "");
    return resolved.externalVarPrefixes.some((p) => name === p || name.startsWith(`${p}-`));
  };
  const missing = [...varsUsed(styles)].filter((v) => !defined.has(v) && !declared.has(v) && !external(v)).sort();
  if (!missing.length) return;

  out.push({
    id: "tokens-components-need",
    level: "error",
    title: `${missing.length} custom propert${missing.length === 1 ? "y your components read is" : "ies your components read are"} not defined anywhere: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? `, and ${missing.length - 6} more` : ""}.`,
    detail: "They resolve to nothing at runtime. A component added from the registry can read a token family added after this project was created.",
    fix: "zengin upgrade --write takes the tokens the registry has and this project lacks, additively.",
  });
}

function cssUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssUnder(p));
    else if (entry.name.endsWith(".css")) out.push(p);
  }
  return out;
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

function render(findings: DoctorFinding[], fixed: string[], fix: boolean, checked: string[] = []): string {
  const lines: string[] = [];
  for (const f of findings) {
    lines.push(`${MARK[f.level](GLYPH[f.level])} ${f.title}`);
    if (f.detail) lines.push(`  ${dim(f.detail)}`);
    // `fix` is what this command can do; `by hand` is what only a person can. Rendering both as "fix" under a
    // flag named --fix told the reader the matcher had been changed when it had not.
    if (f.fix && f.level !== "ok") lines.push(`  ${dim(f.fixable ? "fix" : "by hand")}  ${f.fix}`);
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
  // What was examined, not only what was found: a command that reports nothing should say what it looked at,
  // or a clean run reads as "everything is fine" when it means "these five things are fine".
  if (checked.length) lines.push(dim(`Checked: ${checked.join(", ")}. This command does not judge your code — that is zengin check.`));

  const fixable = findings.some((f) => f.fixable && f.level !== "ok");
  if (fixable && !fix) lines.push(dim("zengin doctor --fix repairs the ones marked fix: the files Zengin itself writes."));
  // After a --fix run, everything still listed is something this command decided not to do. Say so, rather
  // than leaving a reader to infer it from a label.
  if (fix && findings.some((f) => f.level !== "ok"))
    lines.push(dim("What is left needs a person: --fix writes the files Zengin writes, and nothing else."));
  if (fixed.length) lines.push(dim("The MCP server and the hook are read when an agent session starts. Open a new session for these to take effect."));
  if (errors || warns) lines.push(dim("Component drift against the registry is a different question: zengin upgrade."));
  return lines.join("\n");
}
