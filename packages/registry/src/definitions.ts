import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadTokens } from "@zenginui/engine";
import { LAYOUT, type RegistryItem } from "./schema.js";

/**
 * The definitions a project owns are the third thing `create` writes once and nothing carries forward.
 *
 * The components in `src/components/ui` have an upgrade path: each file records the version it was copied
 * from, so `zengin upgrade` can tell current from edited. `zengin/tokens.json` records nothing, because JSON
 * cannot carry a pragma comment — so it sat outside upgrade's world entirely, and upgrade reported
 * "everything is what the registry ships" about a project whose definitions were a release behind.
 *
 * That is not cosmetic. A component added later can reference a token family added later: `zengin add
 * combobox` into a project created before the `tracking` family installed a stylesheet whose
 * `var(--tracking-wider)` resolves to nothing, and the engine correctly failed the project that had just
 * been told it was up to date. The component was current, the definitions were not, and nothing compared
 * them.
 *
 * The comparison here is by token, not by file, because a project's definitions are not the registry's to
 * replace: a brand changes values on purpose, and `zengin define` writes the project's own components into
 * the manifest. What the registry adds is additive, and additive is the only part taken.
 */
export interface TokenDrift {
  /** Tokens the registry defines and the project does not have at all. */
  missing: { name: string; cssVar: string; path: string; value: string }[];
  /** Tokens both have with different values: the project's own, and left alone. */
  yours: { name: string; cssVar: string; value: string; upstream: string }[];
}

const EMPTY: TokenDrift = { missing: [], yours: [] };

export function foundationTokens(items: RegistryItem[], file = "tokens.json"): unknown | undefined {
  const foundation = items.find((i) => i.name === "foundation" && i.type === "definitions");
  const entry = foundation?.files?.find((f) => f.path === `${LAYOUT.definitionsDir}/${file}`);
  return entry ? (JSON.parse(entry.content) as unknown) : undefined;
}

/** What the registry's tokens have that this project's do not, and where the two disagree. */
export function tokenDrift(definitionsDir: string, upstream: unknown, file = "tokens.json"): TokenDrift {
  const path = join(definitionsDir, file);
  if (!upstream || !existsSync(path)) return EMPTY;
  const mine = loadTokens(JSON.parse(readFileSync(path, "utf8")));
  const theirs = loadTokens(upstream);
  const byVar = new Map(mine.map((t) => [t.cssVar, t]));

  const drift: TokenDrift = { missing: [], yours: [] };
  for (const t of theirs) {
    const own = byVar.get(t.cssVar);
    if (!own) drift.missing.push({ name: t.name, cssVar: t.cssVar, path: t.path, value: t.value });
    else if (own.value !== t.value) drift.yours.push({ name: t.name, cssVar: own.cssVar, value: own.value, upstream: t.value });
  }
  return drift;
}

/**
 * Adds the named tokens to the project's definitions, taking each one's group from upstream so the type and
 * any `$description` come with it. Values the project already has are never touched.
 */
export function addTokens(definitionsDir: string, upstream: unknown, paths: string[], file = "tokens.json"): number {
  if (!paths.length) return 0;
  const target = join(definitionsDir, file);
  const mine = existsSync(target) ? (JSON.parse(readFileSync(target, "utf8")) as Record<string, unknown>) : {};
  const theirs = upstream as Record<string, unknown>;

  let added = 0;
  for (const path of paths) {
    const segments = path.split(".");
    const source = at(theirs, segments);
    if (source === undefined) continue;
    if (put(mine, segments, source)) added += 1;
  }
  if (added) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(mine, null, 2)}\n`);
  }
  return added;
}

function at(obj: Record<string, unknown>, segments: string[]): unknown {
  let node: unknown = obj;
  for (const s of segments) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[s];
  }
  return node;
}

/** Writes a value at a dotted path, creating groups on the way, and never overwriting what is already there. */
function put(obj: Record<string, unknown>, segments: string[], value: unknown): boolean {
  let node = obj;
  for (const s of segments.slice(0, -1)) {
    const next = node[s];
    if (next === undefined) node[s] = {};
    else if (typeof next !== "object" || next === null) return false;
    node = node[s] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1]!;
  if (node[last] !== undefined) return false;
  node[last] = value;
  return true;
}

/** The custom properties a set of files reads, which is what tells us a component needs a token the project lacks. */
export function varsUsed(contents: string[]): Set<string> {
  const out = new Set<string>();
  for (const content of contents) {
    for (const m of content.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) out.add(m[1]!);
  }
  return out;
}
