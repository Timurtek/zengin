import { parse } from "@babel/parser";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Node } from "./types.js";

/**
 * The modules a package entry reaches. A design system's `index.ts` or `index.d.ts` is usually a barrel,
 * `export * from "./components"`, so the components are in the files it re-exports and their props types in the
 * files those import. `exported` is what re-exports reach (the public surface); `all` adds what the public files
 * import, where props types and enums live.
 */
export interface ModuleGraph {
  entry: string;
  exported: string[];
  all: string[];
}

const EXTENSIONS = [".ts", ".tsx", ".d.ts", ".d.mts", ".mts", ".jsx", ".js"];
const MAX_FILES = 2000;

/** A relative specifier to a file: `./button`, `./button.js` (ESM declarations), `./components` (its index). */
export function resolveModule(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = resolve(dirname(from), spec);
  const stem = base.replace(/\.(m?js|jsx)$/, "");
  const candidates = [
    base,
    ...EXTENSIONS.map((e) => stem + e),
    ...EXTENSIONS.map((e) => join(base, "index" + e)),
  ];
  for (const c of candidates) {
    try {
      if (existsSync(c) && statSync(c).isFile() && !/\.(css|json|svg|png)$/.test(c)) return c;
    } catch {
      // unreadable: try the next shape
    }
  }
  return undefined;
}

export function parseModule(file: string, content = readFileSync(file, "utf8")): Node[] {
  const dts = /\.d\.m?ts$/.test(file);
  const plugins: unknown[] = dts ? [["typescript", { dts: true }]] : ["typescript", ...(/\.(tsx|jsx)$/.test(file) || !/\.ts$/.test(file) ? ["jsx"] : [])];
  try {
    const ast = parse(content, { sourceType: "module", plugins: plugins as never, errorRecovery: true }) as unknown as { program: { body: Node[] } };
    return ast.program.body;
  } catch {
    return [];
  }
}

/** Relative specifiers a module re-exports from, and those it imports from. */
function specifiers(body: Node[]): { reexports: string[]; imports: string[] } {
  const reexports: string[] = [];
  const imports: string[] = [];
  for (const node of body) {
    const source = (node["source"] as Node | undefined)?.["value"];
    if (typeof source !== "string") continue;
    if (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") reexports.push(source);
    else if (node.type === "ImportDeclaration") imports.push(source);
  }
  return { reexports, imports };
}

export function moduleGraph(entry: string): ModuleGraph {
  const exported = new Set<string>();
  const all = new Set<string>();
  const queue: { file: string; exported: boolean }[] = [{ file: entry, exported: true }];
  while (queue.length && all.size < MAX_FILES) {
    const { file, exported: isExported } = queue.shift()!;
    if (all.has(file) && (!isExported || exported.has(file))) continue;
    all.add(file);
    if (isExported) exported.add(file);
    const { reexports, imports } = specifiers(parseModule(file));
    for (const spec of reexports) {
      const next = resolveModule(file, spec);
      if (next) queue.push({ file: next, exported: isExported });
    }
    for (const spec of imports) {
      const next = resolveModule(file, spec);
      if (next && !all.has(next)) queue.push({ file: next, exported: false });
    }
  }
  return { entry, exported: [...exported], all: [...all] };
}
