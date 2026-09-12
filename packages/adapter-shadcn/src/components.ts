import { parse } from "@babel/parser";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentManifest, PropManifest } from "@zengin/engine";
import { defaultAllow, HEADLESS_BY_FILE, INTRINSIC_BY_FILE, ownedPropertyOf, pascal, RADIX_ROOT_PROPS, type PropSpec } from "./knowledge.js";

/**
 * The components half: every file in the ui directory becomes a manifest entry. Variants come from the
 * file's `cva()` call, sub-parts from its PascalCase exports, behavior props from the Radix package it
 * imports, and `owns` from the utilities the cva base and variants set.
 */

type Node = { type: string; [k: string]: unknown };

export interface DerivedComponent {
  manifest: ComponentManifest;
  /** Defaults the team should look at: className.allow and owns are heuristics. */
  review: string[];
}

export interface ComponentScan {
  components: DerivedComponent[];
  /** Files that yielded no component (hooks, utilities, files with no PascalCase export). */
  skipped: string[];
}

export function scanUiDir(projectDir: string, uiDir: string, uiAlias: string): ComponentScan {
  const components: DerivedComponent[] = [];
  const skipped: string[] = [];
  for (const file of readdirSync(join(projectDir, uiDir)).sort()) {
    if (!/\.(tsx|jsx)$/.test(file)) continue;
    const stem = file.replace(/\.(tsx|jsx)$/, "");
    const content = readFileSync(join(projectDir, uiDir, file), "utf8");
    const derived = deriveComponent(stem, content, `${uiAlias}/${stem}`);
    if (derived) components.push(derived);
    else skipped.push(`${uiDir}/${file}`);
  }
  return { components, skipped };
}

export function deriveComponent(stem: string, content: string, importFrom: string): DerivedComponent | undefined {
  let ast: { program: Node };
  try {
    ast = parse(content, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true }) as unknown as { program: Node };
  } catch {
    return undefined;
  }

  const exported = exportedNames(ast.program);
  const pascalNames = exported.filter((n) => /^[A-Z]/.test(n));
  if (pascalNames.length === 0) return undefined;

  const expected = pascal(stem);
  const primary = pascalNames.includes(expected) ? expected : pascalNames.slice().sort((a, b) => a.length - b.length).find((n) => pascalNames.every((o) => o === n || o.startsWith(n))) ?? pascalNames[0]!;
  const slots = pascalNames.filter((n) => n !== primary && n.startsWith(primary) && !/Variants$/.test(n)).map((n) => n.slice(primary.length)).filter(Boolean);

  const cva = findCva(ast.program);
  const props: Record<string, PropManifest> = {};
  const review: string[] = [];
  const owns: Record<string, string | null> = {};

  if (cva) {
    // A property the base classes set belongs to the component itself (null). A property only a variant
    // sets belongs to that variant prop. Base first, so a variant repeating a base utility does not claim it.
    for (const u of cva.base.split(/\s+/).filter(Boolean)) {
      const prop = ownedPropertyOf(u);
      if (prop && !(prop in owns)) owns[prop] = null;
    }
    for (const [name, spec] of Object.entries(cva.variants)) {
      const values = Object.keys(spec);
      if (values.length === 0) continue;
      const def = cva.defaults[name];
      props[name] = { type: "enum", values, ...(def !== undefined && values.includes(def) ? { default: def } : {}) };
      for (const classes of Object.values(spec)) {
        for (const u of classes.split(/\s+/).filter(Boolean)) {
          const prop = ownedPropertyOf(u);
          if (prop && !(prop in owns)) owns[prop] = name;
        }
      }
    }
  }

  const imports = importSources(ast.program);
  const radix = imports.map((s) => /^@radix-ui\/react-([\w-]+)$/.exec(s)?.[1]).find((s): s is string => !!s);
  if (radix && RADIX_ROOT_PROPS[radix]) {
    for (const [name, spec] of Object.entries(RADIX_ROOT_PROPS[radix])) if (!(name in props)) props[name] = toManifestProp(spec);
  }
  if (content.includes("asChild")) props["asChild"] = { type: "boolean", default: false };

  const replaces: string[] = [];
  const intrinsic = INTRINSIC_BY_FILE[stem];
  if (intrinsic) replaces.push(intrinsic);
  if (radix) replaces.push(`@radix-ui/react-${radix}#*`);
  for (const h of HEADLESS_BY_FILE[stem] ?? []) replaces.push(h);

  const allow = defaultAllow(stem);
  review.push(`${primary}: className.allow defaults to [${allow.join(", ")}]`);
  if (Object.keys(owns).length) review.push(`${primary}: owns derived from cva classes: ${Object.keys(owns).join(", ")}`);

  const manifest: ComponentManifest = {
    name: primary,
    since: "0.0.0",
    export: { from: importFrom, name: primary },
    ...(replaces.length ? { replaces } : {}),
    ...(intrinsic && intrinsic !== "dialog" && intrinsic !== "hr" ? { extends: intrinsic } : {}),
    props,
    className: { allow },
    ...(Object.keys(owns).length ? { owns } : {}),
    ...(slots.length ? { slots } : {}),
  };
  return { manifest, review };
}

function toManifestProp(spec: PropSpec): PropManifest {
  return { type: spec.type, ...(spec.values ? { values: spec.values } : {}), ...(spec.default !== undefined ? { default: spec.default } : {}) };
}

// ---------------------------------------------------------------------------
// AST helpers. Babel nodes are walked loosely; only a few shapes matter.
// ---------------------------------------------------------------------------

function exportedNames(program: Node): string[] {
  const out: string[] = [];
  for (const stmt of program["body"] as Node[]) {
    if (stmt.type === "ExportNamedDeclaration") {
      for (const s of (stmt["specifiers"] as Node[]) ?? []) {
        const ex = s["exported"] as Node;
        out.push((ex["name"] as string) ?? (ex["value"] as string));
      }
      const decl = stmt["declaration"] as Node | null;
      if (decl) {
        if (decl["id"]) out.push(((decl["id"] as Node)["name"] as string) ?? "");
        for (const d of (decl["declarations"] as Node[]) ?? []) {
          const id = d["id"] as Node;
          if (id.type === "Identifier") out.push(id["name"] as string);
        }
      }
    }
    if (stmt.type === "ExportDefaultDeclaration") {
      const decl = stmt["declaration"] as Node;
      if (decl["id"]) out.push((decl["id"] as Node)["name"] as string);
      else if (decl.type === "Identifier") out.push(decl["name"] as string);
    }
  }
  return [...new Set(out.filter(Boolean))];
}

function importSources(program: Node): string[] {
  return (program["body"] as Node[]).filter((s) => s.type === "ImportDeclaration").map((s) => (s["source"] as Node)["value"] as string);
}

interface CvaCall {
  base: string;
  variants: Record<string, Record<string, string>>;
  defaults: Record<string, string>;
}

function findCva(program: Node): CvaCall | undefined {
  let found: CvaCall | undefined;
  const visit = (n: Node | null | undefined): void => {
    if (!n || typeof n !== "object" || found) return;
    if (n.type === "CallExpression") {
      const callee = n["callee"] as Node;
      if (callee.type === "Identifier" && (callee["name"] === "cva" || callee["name"] === "tv")) {
        // cva(base, { variants, defaultVariants }) and tv({ base, variants, defaultVariants }).
        const [first, second] = n["arguments"] as Node[];
        const options = first?.type === "ObjectExpression" ? first : second;
        const baseNode = first?.type === "ObjectExpression" ? ((first["properties"] as Node[]).find((p) => keyOf(p) === "base")?.["value"] as Node | undefined) : first;
        found = { base: baseNode ? stringOf(baseNode) : "", variants: {}, defaults: {} };
        if (options?.type === "ObjectExpression") {
          for (const p of options["properties"] as Node[]) {
            const key = keyOf(p);
            const value = p["value"] as Node | undefined;
            if (key === "variants" && value?.type === "ObjectExpression") {
              for (const vp of value["properties"] as Node[]) {
                const vname = keyOf(vp);
                const vval = vp["value"] as Node | undefined;
                if (!vname || vval?.type !== "ObjectExpression") continue;
                const entries: Record<string, string> = {};
                for (const opt of vval["properties"] as Node[]) {
                  const oname = keyOf(opt);
                  if (oname) entries[oname] = stringOf(opt["value"] as Node);
                }
                found.variants[vname] = entries;
              }
            }
            if (key === "defaultVariants" && value?.type === "ObjectExpression") {
              for (const dp of value["properties"] as Node[]) {
                const dname = keyOf(dp);
                const dval = dp["value"] as Node | undefined;
                if (dname && dval?.type === "StringLiteral") found.defaults[dname] = dval["value"] as string;
              }
            }
          }
        }
        return;
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "loc") continue;
      if (Array.isArray(v)) {
        for (const item of v as unknown[]) if (item && typeof item === "object" && "type" in item) visit(item as Node);
      } else if (v && typeof v === "object" && "type" in (v as object)) {
        visit(v as Node);
      }
    }
  };
  visit(program);
  return found;
}

function keyOf(p: Node): string | undefined {
  const key = p["key"] as Node | undefined;
  if (!key) return undefined;
  if (key.type === "Identifier") return key["name"] as string;
  if (key.type === "StringLiteral") return key["value"] as string;
  return undefined;
}

/** Static text of a string literal, a template literal, or an array/call of those. */
function stringOf(n: Node | undefined): string {
  if (!n) return "";
  if (n.type === "StringLiteral") return n["value"] as string;
  if (n.type === "TemplateLiteral") return (n["quasis"] as Node[]).map((q) => (q["value"] as { cooked: string }).cooked).join(" ");
  if (n.type === "ArrayExpression") return (n["elements"] as Node[]).map(stringOf).join(" ");
  if (n.type === "CallExpression") return (n["arguments"] as Node[]).map(stringOf).join(" ");
  return "";
}
