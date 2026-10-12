import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { ComponentManifest } from "@zenginui/engine";
import { deriveTokensFromCss, type CssDerivation } from "./tokens.js";
import { deriveManifestFromTypes } from "./types.js";

/**
 * A design system exported from Claude Design: a folder with `_ds_manifest.json` next to the tokens' stylesheets
 * and, per component, a `.jsx` with its `.d.ts`. The manifest names the components, the stylesheets and the
 * alternate themes; it does not carry props (those come from the `.d.ts`) and its token `kind` is not trusted:
 * a font size arrives as `spacing` and a text color as `font`. Tokens are read from the stylesheets and classified
 * from their value. The export's `_adherence.oxlintrc.json`, when present, is a second statement of each
 * component's contract; where it disagrees with the `.d.ts` the disagreement is reported, never resolved.
 */

interface DsManifest {
  namespace: string;
  components: { name: string; sourcePath: string }[];
  globalCssPaths?: string[];
  tokens?: { name: string; value: string; kind: string; definedIn: string; scope?: string }[];
  themes?: { selector: string; label?: string }[];
}

export interface ContractFinding {
  component: string;
  kind: "prop-only-in-types" | "prop-only-in-adherence" | "values-differ" | "component-only-in-adherence" | "component-without-contract";
  detail: string;
}

export interface ClaudeDesignDerivation {
  tokens: Record<string, unknown>;
  /** One file per alternate theme the manifest names, keyed by a file-safe label. */
  themes: Record<string, Record<string, unknown>>;
  components: ComponentManifest[];
  config: string;
  findings: ContractFinding[];
  report: {
    namespace: string;
    stylesheets: string[];
    tokenCount: number;
    byGroup: Record<string, number>;
    themeNames: string[];
    themeOverrides: Record<string, number>;
    manifestTokens: number;
    /** Variables the manifest lists that the stylesheets did not yield as tokens, and the reverse. */
    onlyInManifest: string[];
    onlyInStylesheets: string[];
    /** Variables whose manifest `kind` disagrees with the group classified from the value. */
    kindDisagreements: { name: string; kind: string; group: string }[];
    skippedVariables: string[];
    componentCount: number;
    withoutTypes: string[];
    adherenceFile: string | undefined;
  };
}

/** The manifest's `kind` per Zengin group it would be correct for. A mismatch is a finding about the export, not about us. */
const KIND_TO_GROUP: Record<string, string[]> = { color: ["color"], font: ["font", "other"], spacing: ["space"], radius: ["radius"], shadow: ["shadow"], other: ["other"] };

/** True when `rel` resolves to a place inside `dir`. */
function isInside(dir: string, rel: string): boolean {
  const r = relative(resolve(dir), resolve(dir, rel));
  return r !== "" && !r.startsWith("..") && !isAbsolute(r);
}

/** The manifest is another tool's output: check every field this adapter uses, and keep every path inside the export. */
export function validateManifest(json: string, manifestPath: string, dir: string): DsManifest {
  const fail = (why: string): never => {
    throw new Error(`${manifestPath}: ${why}. This is not the shape this adapter reads.`);
  };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return fail(`not valid JSON (${(e as Error).message})`);
  }
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object" || Array.isArray(m)) return fail("expected a JSON object");
  if (typeof m.namespace !== "string" || !/^[A-Za-z_$][\w$]*$/.test(m.namespace)) return fail('"namespace" must be a JavaScript identifier');
  if (!Array.isArray(m.components)) return fail('"components" must be an array');
  m.components.forEach((c: unknown, i) => {
    const e = c as Record<string, unknown> | null;
    if (!e || typeof e.name !== "string" || !/^[A-Za-z_$][\w$]*$/.test(e.name)) fail(`components[${i}].name must be an identifier`);
    if (typeof e!.sourcePath !== "string" || !isInside(dir, e!.sourcePath)) fail(`components[${i}].sourcePath must be a path inside the export`);
  });
  if (m.globalCssPaths !== undefined) {
    if (!Array.isArray(m.globalCssPaths)) return fail('"globalCssPaths" must be an array');
    m.globalCssPaths.forEach((p: unknown, i) => {
      if (typeof p !== "string" || !isInside(dir, p) || /["\n\r]/.test(p)) fail(`globalCssPaths[${i}] must be a plain path inside the export`);
    });
  }
  if (m.tokens !== undefined && !Array.isArray(m.tokens)) return fail('"tokens" must be an array');
  if (Array.isArray(m.tokens)) {
    m.tokens.forEach((t: unknown, i) => {
      const e = t as Record<string, unknown> | null;
      if (!e || typeof e.name !== "string" || typeof e.kind !== "string") fail(`tokens[${i}] needs a string name and kind`);
    });
  }
  if (m.themes !== undefined && !Array.isArray(m.themes)) return fail('"themes" must be an array');
  if (Array.isArray(m.themes)) {
    m.themes.forEach((t: unknown, i) => {
      const e = t as Record<string, unknown> | null;
      if (!e || typeof e.selector !== "string") fail(`themes[${i}].selector must be a string`);
      if (e!.label !== undefined && typeof e!.label !== "string") fail(`themes[${i}].label must be a string`);
    });
    if (m.themes.length > 1) {
      fail(`"themes" names ${m.themes.length} themes; this adapter writes one alternate theme and will not merge them silently. Keep one theme in the manifest, or split the export`);
    }
  }
  return m as unknown as DsManifest;
}

/** The path of an existing file inside the export, or undefined when it is missing. A symlink or junction that leads out of the export is an error. */
function existingInside(dir: string, rel: string): string | undefined {
  const full = join(dir, rel);
  if (!existsSync(full)) return undefined;
  const real = realpathSync(full);
  const inside = relative(realpathSync(dir), real);
  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
    throw new Error(`${rel} resolves to ${real}, outside the export at ${dir}. A link that leaves the export is not followed.`);
  }
  return full;
}

export function deriveClaudeDesign(dir: string): ClaudeDesignDerivation {
  const manifestPath = join(dir, "_ds_manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`No _ds_manifest.json in ${dir}. This is not a Claude Design export; point --from claude-design at the exported folder.`);
  const ds = validateManifest(readFileSync(manifestPath, "utf8"), manifestPath, dir);

  // Windows exports can write `tokens\colors.css`; globs and the YAML want `/`.
  const stylesheets = (ds.globalCssPaths ?? []).map((p) => p.replace(/\\/g, "/"));
  if (!stylesheets.length) throw new Error(`${manifestPath} lists no globalCssPaths, so there are no tokens to derive.`);
  stylesheets.forEach((p, i) => {
    const found = existingInside(dir, p);
    if (!found) throw new Error(`${manifestPath}: globalCssPaths[${i}] "${p}" does not exist in the export. Every stylesheet the manifest lists is required; tokens from a partial set would be wrong.`);
    if (!statSync(found).isFile()) throw new Error(`${manifestPath}: globalCssPaths[${i}] "${p}" is not a file.`);
  });
  const css = stylesheets.map((p) => readFileSync(join(dir, p), "utf8")).join("\n");
  const themeSelectors = (ds.themes ?? []).map((t) => t.selector);
  const derived: CssDerivation = deriveTokensFromCss(css, { themeSelectors });

  const names = new Set(derived.light.map((t) => t.cssVar));
  const manifestNames = new Set((ds.tokens ?? []).filter((t) => !t.scope).map((t) => t.name));
  const groupOf = new Map(derived.light.map((t) => [t.cssVar, t.group]));
  const kindDisagreements: ClaudeDesignDerivation["report"]["kindDisagreements"] = [];
  for (const t of ds.tokens ?? []) {
    if (t.scope) continue;
    const group = groupOf.get(t.name);
    if (group && !(KIND_TO_GROUP[t.kind] ?? []).includes(group)) kindDisagreements.push({ name: t.name, kind: t.kind, group });
  }

  const components: ComponentManifest[] = [];
  const withoutTypes: string[] = [];
  for (const c of ds.components) {
    const dts = existingInside(dir, c.sourcePath.replace(/\.jsx?$/, ".d.ts"));
    if (!dts) {
      withoutTypes.push(c.name);
      continue;
    }
    const d = deriveManifestFromTypes(readFileSync(dts, "utf8"), { importFrom: ds.namespace, only: [c.name] });
    if (d.components[0]) components.push(d.components[0]);
    else withoutTypes.push(c.name);
  }

  const adherencePath = existingInside(dir, "_adherence.oxlintrc.json");
  const adherenceFile = adherencePath ? "_adherence.oxlintrc.json" : undefined;
  const findings = adherencePath ? crossCheck(components, readFileSync(adherencePath, "utf8"), ds.components.map((c) => c.name)) : [];

  const themes: Record<string, Record<string, unknown>> = {};
  const themeOverrides: Record<string, number> = {};
  if (derived.tokensDark) {
    // deriveTokensFromCss folds every named theme into one override set; validateManifest allows at most one, so that is the theme.
    const label = (ds.themes?.[0]?.label ?? "dark").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    themes[label] = derived.tokensDark;
    themeOverrides[label] = derived.dark.length;
  }

  return {
    tokens: derived.tokens,
    themes,
    components,
    config: renderConfig(ds.namespace, stylesheets),
    findings,
    report: {
      namespace: ds.namespace,
      stylesheets,
      tokenCount: derived.light.length,
      byGroup: derived.report.byGroup,
      themeNames: (ds.themes ?? []).map((t) => t.label ?? t.selector),
      themeOverrides,
      manifestTokens: manifestNames.size,
      onlyInManifest: [...manifestNames].filter((n) => !names.has(n)).sort(),
      onlyInStylesheets: [...names].filter((n) => !manifestNames.has(n)).sort(),
      kindDisagreements,
      skippedVariables: derived.report.skipped,
      componentCount: components.length,
      withoutTypes,
      adherenceFile,
    },
  };
}

const ALWAYS_ALLOWED = new Set(["key", "ref", "className", "style", "children"]);

interface AdherenceContract {
  props: Set<string>;
  enums: Record<string, string[]>;
}

/** Contracts as `_adherence.oxlintrc.json` states them: per component, the allowed props and the allowed values of each enum prop. */
export function readAdherence(json: string, file = "_adherence.oxlintrc.json"): Record<string, AdherenceContract> {
  const fail = (why: string): never => {
    throw new Error(`${file}: ${why}. This is not the shape this adapter reads.`);
  };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return fail(`not valid JSON (${(e as Error).message})`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("expected a JSON object");
  const rules = (raw as { rules?: unknown }).rules;
  if (rules !== undefined && (!rules || typeof rules !== "object" || Array.isArray(rules))) return fail('"rules" must be an object');
  const rule = (rules as Record<string, unknown> | undefined)?.["no-restricted-syntax"];
  const out: Record<string, AdherenceContract> = {};
  if (rule === undefined) return out;
  if (!Array.isArray(rule)) return fail('"rules.no-restricted-syntax" must be an array');
  rule.slice(1).forEach((entry: unknown, i) => {
    const e = entry as { selector?: unknown } | null;
    if (!e || typeof e !== "object" || typeof e.selector !== "string") fail(`rules.no-restricted-syntax[${i + 1}].selector must be a string`);
    readSelector(out, (e as { selector: string }).selector);
  });
  return out;
}

function readSelector(out: Record<string, AdherenceContract>, sel: string): void {
  const comp = /JSXOpeningElement\[name\.name='(\w+)'\]/.exec(sel)?.[1];
  if (!comp) return;
  const contract = (out[comp] ??= { props: new Set(), enums: {} });
  const allowed = /JSXIdentifier\[name!=\/\^\(\?:([^)]*)\)\$\/\]/.exec(sel)?.[1];
  if (allowed) for (const p of allowed.split("|")) if (!ALWAYS_ALLOWED.has(p)) contract.props.add(p);
  const en = /JSXAttribute\[name\.name='(\w+)'\] > Literal\[value!=\/\^\(\?:([^)]*)\)\$\/\]/.exec(sel);
  if (en) contract.enums[en[1]!] = en[2]!.split("|");
}

/** Where the `.d.ts` contracts and the adherence config disagree. Neither wins; each disagreement is a finding. */
export function crossCheck(components: ComponentManifest[], adherenceJson: string, manifestNames: string[]): ContractFinding[] {
  const adherence = readAdherence(adherenceJson);
  const findings: ContractFinding[] = [];
  const byName = new Map(components.map((c) => [c.name, c]));
  for (const name of Object.keys(adherence).sort()) {
    if (!manifestNames.includes(name)) findings.push({ component: name, kind: "component-only-in-adherence", detail: `the adherence config states a contract for <${name}>, which the manifest does not list` });
  }
  for (const c of components) {
    const contract = adherence[c.name];
    if (!contract) {
      findings.push({ component: c.name, kind: "component-without-contract", detail: "the adherence config states no contract for it; nothing stops an unknown prop or a wrong enum value" });
      continue;
    }
    const typed = Object.keys(c.props ?? {});
    for (const p of typed) if (!contract.props.has(p)) findings.push({ component: c.name, kind: "prop-only-in-types", detail: `"${p}" is declared in the .d.ts and rejected by the adherence config` });
    for (const p of contract.props) if (!typed.includes(p)) findings.push({ component: c.name, kind: "prop-only-in-adherence", detail: `"${p}" is allowed by the adherence config and absent from the .d.ts` });
    for (const [prop, values] of Object.entries(contract.enums)) {
      const declared = c.props?.[prop]?.values;
      if (declared && [...declared].sort().join("|") !== [...values].sort().join("|")) {
        findings.push({ component: c.name, kind: "values-differ", detail: `"${prop}": .d.ts says ${declared.join(" | ")}; the adherence config says ${values.join(" | ")}` });
      }
    }
  }
  return findings;
}

function renderConfig(namespace: string, stylesheets: string[]): string {
  // JSON strings are valid YAML double-quoted scalars, so JSON.stringify escapes quotes, backslashes and newlines.
  const found = JSON.stringify(stylesheets);
  return `# Derived by @zenginui/adapter-css from a Claude Design export (${namespace}). Definitions live in ./zengin; regenerate with: zengin init --from claude-design --force
system:
  package: ${JSON.stringify(namespace)}
  version: "0.0.0"                # a Claude Design export carries no version
  definitions: ./zengin
  sources: [${JSON.stringify(namespace)}]

scope:
  include: ["ui_kits/**/*.{js,jsx,css}", "components/**/*.{js,jsx}", "*.css"]
  exclude: ["**/node_modules/**", "**/*.d.ts", "_ds_bundle.js"]
  foundations: ${found}   # the export's own stylesheets: literals live here
  ownership: ["components/**"]   # the components are the system itself; their internals are not consumers

classes:
  tailwind: false

rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: warn
  component-substitution: error
`;
}

export interface WriteResult {
  written: string[];
}

/**
 * Refuses a write target that would land outside the export: the nearest existing ancestor must resolve inside it,
 * and a target that already exists must not be a link (a link is followed by the write, with or without --force).
 */
function assertWriteInside(dir: string, rel: string): void {
  const root = realpathSync(dir);
  const target = join(dir, rel);
  let probe = target;
  while (!existsSync(probe) && !isLink(probe)) probe = dirname(probe);
  if (isLink(target)) throw new Error(`${rel} is a link; a generated file is not written through a link. Remove it and run again.`);
  const real = relative(root, realpathSync(probe));
  if (real.startsWith("..") || isAbsolute(real)) throw new Error(`${rel} would be written to ${realpathSync(probe)}, outside the export at ${dir}. A link that leaves the export is not followed.`);
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Writes the derivation into `dir`. Refuses to overwrite existing files unless `force`. */
export function writeClaudeDesign(dir: string, d: ClaudeDesignDerivation, force = false): WriteResult {
  const targets: [string, string][] = [
    ["zengin/tokens.json", JSON.stringify(d.tokens, null, 2) + "\n"],
    ["zengin/components.json", JSON.stringify(d.components, null, 2) + "\n"],
    ["zengin.config.yaml", d.config],
  ];
  const [theme] = Object.entries(d.themes);
  if (theme) targets.push(["zengin/tokens.dark.json", JSON.stringify(theme[1], null, 2) + "\n"]);
  for (const [p] of targets) assertWriteInside(dir, p);
  const existing = targets.map(([p]) => p).filter((p) => existsSync(join(dir, p)));
  if (existing.length && !force) throw new Error(`Refusing to overwrite ${existing.join(", ")}. Pass --force to regenerate.`);
  for (const [p, content] of targets) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), content);
  }
  return { written: targets.map(([p]) => p) };
}

export function renderClaudeDesignReport(d: ClaudeDesignDerivation): string {
  const r = d.report;
  const groups = Object.entries(r.byGroup)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${n} ${g}`)
    .join(", ");
  const lines = [
    `Claude Design export: ${r.namespace}`,
    `Tokens: ${r.tokenCount} from ${r.stylesheets.join(", ")} (${groups}); the manifest lists ${r.manifestTokens}`,
    `Themes: ${r.themeNames.length ? r.themeNames.map((n) => `${n} (${r.themeOverrides[n.toLowerCase().replace(/[^a-z0-9]+/g, "-")] ?? 0} overrides)`).join(", ") : "none: the manifest names no theme, so this export has one"}`,
    `Components: ${r.componentCount} from their .d.ts${r.withoutTypes.length ? `; no declarations for ${r.withoutTypes.join(", ")}` : ""}`,
    `Token kind: not trusted. ${r.kindDisagreements.length} manifest kinds disagree with the value${r.kindDisagreements.length ? ` (${r.kindDisagreements.map((k) => `${k.name}: ${k.kind} vs ${k.group}`).join("; ")})` : ""}`,
  ];
  if (r.onlyInManifest.length) lines.push(`In the manifest, not a token here: ${r.onlyInManifest.join(", ")}`);
  if (r.onlyInStylesheets.length) lines.push(`In the stylesheets, not in the manifest: ${r.onlyInStylesheets.join(", ")}`);
  if (r.skippedVariables.length) lines.push(`Not tokens (unclassified values): ${r.skippedVariables.join(", ")}`);
  if (r.adherenceFile) {
    lines.push(`Contracts cross-checked against ${r.adherenceFile}: ${d.findings.length} disagreement${d.findings.length === 1 ? "" : "s"}`);
    for (const f of d.findings) lines.push(`  ${f.component}: ${f.detail}`);
  } else lines.push("No _adherence.oxlintrc.json: the .d.ts files are the only statement of each contract.");
  lines.push("", "Variable names are kept: the engine suggests the export's own var(--name), not a renamed token.", "Components are used through window." + r.namespace + " in the export, not imported; the engine sees only what is imported from that name.", "Next: zengin check");
  return lines.join("\n");
}
