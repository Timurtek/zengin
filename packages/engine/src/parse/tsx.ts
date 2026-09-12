import { parse } from "@babel/parser";
import type { Range } from "../types.js";
import { LineIndex } from "./positions.js";

/** A static string found in a class position, with the offset of its first character in the file. */
export interface StringSpan {
  value: string;
  offset: number;
  range: Range;
}

/** A static property inside a `style={{ ... }}` object. */
export interface StyleProp {
  /** CSS property name in kebab-case. */
  prop: string;
  value: string;
  /** Range of the whole `key: value` property. */
  range: Range;
  valueRange: Range;
  source: string;
}

export interface JsxAttr {
  name: string;
  range: Range;
  /** Raw source of the whole attribute. */
  source: string;
  /** Static string value: a string literal or a template literal without expressions. */
  stringValue?: string;
  stringValueRange?: Range;
  /** Static class strings found in the value (for className/class). */
  classSpans: StringSpan[];
  /** Static style properties found in the value (for style). */
  styleProps: StyleProp[];
  /** True when part of the value could not be read statically. */
  dynamic: boolean;
  /** Names of `xxxVariants(...)` calls found in a class position, e.g. `buttonVariants`. */
  variantCalls: string[];
}

export interface JsxElementInfo {
  /** Tag as written: `Button`, `Dialog.Panel`, `button`. */
  tag: string;
  /** First segment of the tag. */
  rootName: string;
  isIntrinsic: boolean;
  range: Range;
  openingRange: Range;
  attrs: JsxAttr[];
  selfClosing: boolean;
  /** Raw source of the children, empty when self-closing. */
  childrenSource: string;
  /** Raw source of the opening tag. */
  openingSource: string;
}

export interface ImportUse {
  source: string;
  /** Exported name as imported, `default` for default imports, `*` for namespace imports. */
  imported: string;
  local: string;
  /** Range of the whole import declaration. */
  declarationRange: Range;
  declarationSource: string;
  /** True for `import type` declarations and `type` specifiers. Types cannot be substituted. */
  typeOnly: boolean;
}

export interface Comment {
  text: string;
  line: number;
  endLine: number;
}

export interface TsxFile {
  imports: ImportUse[];
  elements: JsxElementInfo[];
  /** Class strings inside cva/clsx/cn calls that are not attached to an element's className. */
  looseClassSpans: StringSpan[];
  comments: Comment[];
  lines: LineIndex;
}

const CLASS_CALLS = new Set(["cva", "clsx", "cn", "cx", "classnames", "twMerge", "twJoin", "tv"]);
const CLASS_ATTRS = new Set(["className", "class"]);

// Babel AST nodes are typed loosely here; the walker only touches a few well-known shapes.
type Node = { type: string; start?: number | null; end?: number | null; [k: string]: unknown };

export function parseTsx(content: string): TsxFile {
  const ast = parse(content, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
    errorRecovery: true,
  }) as unknown as { program: Node; comments?: { value: string; loc: { start: { line: number }; end: { line: number } } }[] };

  const lines = new LineIndex(content);
  const file: TsxFile = {
    imports: [],
    elements: [],
    looseClassSpans: [],
    comments: (ast.comments ?? []).map((c) => ({ text: c.value.trim(), line: c.loc.start.line, endLine: c.loc.end.line })),
    lines,
  };

  const rangeOf = (n: Node): Range => lines.range(n.start ?? 0, n.end ?? 0);
  const sourceOf = (n: Node): string => content.slice(n.start ?? 0, n.end ?? 0);

  /** Collects static strings from an expression in class position. Returns true when something was dynamic. */
  const collectClassStrings = (n: Node | null | undefined, out: StringSpan[], attached: boolean): boolean => {
    if (!n) return true;
    switch (n.type) {
      case "StringLiteral": {
        out.push({ value: n["value"] as string, offset: (n.start ?? 0) + 1, range: rangeOf(n) });
        return false;
      }
      case "TemplateLiteral": {
        const quasis = n["quasis"] as Node[];
        for (const q of quasis) {
          const raw = (q["value"] as { raw: string }).raw;
          if (raw.trim()) out.push({ value: raw, offset: q.start ?? 0, range: rangeOf(q) });
        }
        let dynamic = false;
        for (const e of n["expressions"] as Node[]) dynamic = collectClassStrings(e, out, attached) || dynamic;
        return dynamic;
      }
      case "JSXExpressionContainer":
        return collectClassStrings(n["expression"] as Node, out, attached);
      case "CallExpression": {
        const callee = n["callee"] as Node;
        const name = callee.type === "Identifier" ? (callee["name"] as string) : undefined;
        if (!name || !CLASS_CALLS.has(name)) return true;
        let dynamic = false;
        for (const a of n["arguments"] as Node[]) dynamic = collectClassStrings(a, out, attached) || dynamic;
        return dynamic;
      }
      case "ArrayExpression": {
        let dynamic = false;
        for (const e of n["elements"] as (Node | null)[]) dynamic = collectClassStrings(e, out, attached) || dynamic;
        return dynamic;
      }
      case "ObjectExpression": {
        // clsx({ "bg-primary": isActive }) and cva variants: { solid: "bg-primary" }
        let dynamic = false;
        for (const p of n["properties"] as Node[]) {
          if (p.type !== "ObjectProperty") {
            dynamic = true;
            continue;
          }
          const key = p["key"] as Node;
          const value = p["value"] as Node;
          if (key.type === "StringLiteral" && (value.type === "BooleanLiteral" || value.type === "Identifier" || value.type === "MemberExpression" || value.type === "UnaryExpression" || value.type === "LogicalExpression" || value.type === "BinaryExpression")) {
            out.push({ value: key["value"] as string, offset: (key.start ?? 0) + 1, range: rangeOf(key) });
            continue;
          }
          dynamic = collectClassStrings(value, out, attached) || dynamic;
        }
        return dynamic;
      }
      case "ConditionalExpression": {
        const a = collectClassStrings(n["consequent"] as Node, out, attached);
        const b = collectClassStrings(n["alternate"] as Node, out, attached);
        return a || b;
      }
      case "LogicalExpression":
        return collectClassStrings(n["right"] as Node, out, attached);
      case "TSAsExpression":
      case "TSNonNullExpression":
      case "ParenthesizedExpression":
        return collectClassStrings(n["expression"] as Node, out, attached);
      default:
        return true;
    }
  };

  const collectStyleProps = (n: Node | null | undefined, out: StyleProp[]): boolean => {
    if (!n) return true;
    if (n.type === "JSXExpressionContainer") return collectStyleProps(n["expression"] as Node, out);
    if (n.type !== "ObjectExpression") return true;
    let dynamic = false;
    for (const p of n["properties"] as Node[]) {
      if (p.type !== "ObjectProperty") {
        dynamic = true;
        continue;
      }
      const key = p["key"] as Node;
      const value = p["value"] as Node;
      const keyName =
        key.type === "Identifier" ? (key["name"] as string) : key.type === "StringLiteral" ? (key["value"] as string) : undefined;
      if (!keyName) {
        dynamic = true;
        continue;
      }
      const prop = toKebab(keyName);
      if (value.type === "StringLiteral") {
        out.push({ prop, value: value["value"] as string, range: rangeOf(p), valueRange: rangeOf(value), source: sourceOf(p) });
      } else if (value.type === "NumericLiteral") {
        const num = value["value"] as number;
        out.push({ prop, value: num === 0 || UNITLESS.has(prop) ? String(num) : `${num}px`, range: rangeOf(p), valueRange: rangeOf(value), source: sourceOf(p) });
      } else {
        dynamic = true;
      }
    }
    return dynamic;
  };

  const readAttr = (a: Node): JsxAttr | undefined => {
    if (a.type !== "JSXAttribute") return undefined;
    const nameNode = a["name"] as Node;
    const name =
      nameNode.type === "JSXNamespacedName"
        ? `${((nameNode["namespace"] as Node)["name"] as string)}:${((nameNode["name"] as Node)["name"] as string)}`
        : (nameNode["name"] as string);
    const value = a["value"] as Node | null;
    const attr: JsxAttr = { name, range: rangeOf(a), source: sourceOf(a), classSpans: [], styleProps: [], dynamic: false, variantCalls: [] };
    if (!value) return attr;
    if (value.type === "StringLiteral") {
      attr.stringValue = value["value"] as string;
      attr.stringValueRange = rangeOf(value);
      if (CLASS_ATTRS.has(name)) attr.classSpans.push({ value: attr.stringValue, offset: (value.start ?? 0) + 1, range: rangeOf(value) });
      return attr;
    }
    if (value.type === "JSXExpressionContainer") {
      const expr = value["expression"] as Node;
      if (expr.type === "StringLiteral") {
        attr.stringValue = expr["value"] as string;
        attr.stringValueRange = rangeOf(expr);
      } else if (expr.type === "TemplateLiteral" && (expr["expressions"] as Node[]).length === 0) {
        attr.stringValue = ((expr["quasis"] as Node[])[0]!["value"] as { cooked: string }).cooked;
        attr.stringValueRange = rangeOf(expr);
      }
      if (CLASS_ATTRS.has(name)) {
        attr.dynamic = collectClassStrings(expr, attr.classSpans, true);
        attr.variantCalls = collectVariantCalls(expr);
      }
      else if (name === "style") attr.dynamic = collectStyleProps(expr, attr.styleProps);
      else if (attr.stringValue === undefined) attr.dynamic = true;
    }
    return attr;
  };

  /** `buttonVariants(...)` style calls anywhere in an expression. */
  const collectVariantCalls = (n: Node | null | undefined, out: string[] = []): string[] => {
    if (!n || typeof n !== "object") return out;
    if (n.type === "CallExpression") {
      const callee = n["callee"] as Node;
      if (callee.type === "Identifier" && /Variants$/.test(callee["name"] as string)) out.push(callee["name"] as string);
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "loc") continue;
      if (Array.isArray(v)) {
        for (const item of v) if (item && typeof item === "object" && "type" in item) collectVariantCalls(item as Node, out);
      } else if (v && typeof v === "object" && "type" in (v as object)) {
        collectVariantCalls(v as Node, out);
      }
    }
    return out;
  };

  const tagName = (n: Node): string => {
    switch (n.type) {
      case "JSXIdentifier":
        return n["name"] as string;
      case "JSXMemberExpression":
        return `${tagName(n["object"] as Node)}.${tagName(n["property"] as Node)}`;
      case "JSXNamespacedName":
        return `${tagName(n["namespace"] as Node)}:${tagName(n["name"] as Node)}`;
      default:
        return "";
    }
  };

  const visit = (n: Node | null | undefined, inClassCall: boolean): void => {
    if (!n || typeof n !== "object") return;
    switch (n.type) {
      case "ImportDeclaration": {
        const source = (n["source"] as Node)["value"] as string;
        const declType = n["importKind"] === "type";
        for (const s of n["specifiers"] as Node[]) {
          const local = (s["local"] as Node)["name"] as string;
          const typeOnly = declType || s["importKind"] === "type";
          const imported =
            s.type === "ImportDefaultSpecifier"
              ? "default"
              : s.type === "ImportNamespaceSpecifier"
                ? "*"
                : ((s["imported"] as Node).type === "Identifier"
                    ? ((s["imported"] as Node)["name"] as string)
                    : ((s["imported"] as Node)["value"] as string));
          file.imports.push({ source, imported, local, declarationRange: rangeOf(n), declarationSource: sourceOf(n), typeOnly });
        }
        return;
      }
      case "JSXElement": {
        const opening = n["openingElement"] as Node;
        const closing = n["closingElement"] as Node | null;
        const tag = tagName(opening["name"] as Node);
        const rootName = tag.split(".")[0]!;
        const attrs = (opening["attributes"] as Node[]).map(readAttr).filter((a): a is JsxAttr => a !== undefined);
        const childrenStart = opening.end ?? 0;
        const childrenEnd = closing ? (closing.start ?? childrenStart) : childrenStart;
        file.elements.push({
          tag,
          rootName,
          isIntrinsic: /^[a-z]/.test(rootName) && !tag.includes("."),
          range: rangeOf(n),
          openingRange: rangeOf(opening),
          attrs,
          selfClosing: !closing,
          childrenSource: content.slice(childrenStart, childrenEnd),
          openingSource: sourceOf(opening),
        });
        for (const c of n["children"] as Node[]) visit(c, false);
        for (const a of opening["attributes"] as Node[]) {
          if (a.type === "JSXAttribute" && a["value"]) {
            const v = a["value"] as Node;
            const nameNode = a["name"] as Node;
            const isClass = CLASS_ATTRS.has(nameNode["name"] as string);
            visit(v, isClass);
          }
          if (a.type === "JSXSpreadAttribute") visit(a["argument"] as Node, false);
        }
        return;
      }
      case "CallExpression": {
        const callee = n["callee"] as Node;
        const name = callee.type === "Identifier" ? (callee["name"] as string) : undefined;
        if (name && CLASS_CALLS.has(name) && !inClassCall) {
          collectClassStrings(n, file.looseClassSpans, false);
          // Still walk into arguments for nested JSX (unlikely) but mark as inside a class call.
          for (const a of n["arguments"] as Node[]) visit(a, true);
          return;
        }
        break;
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments" || k === "innerComments") continue;
      if (Array.isArray(v)) {
        for (const item of v) if (item && typeof item === "object" && "type" in item) visit(item as Node, inClassCall);
      } else if (v && typeof v === "object" && "type" in (v as object)) {
        visit(v as Node, inClassCall);
      }
    }
  };

  visit(ast.program, false);
  return file;
}

const UNITLESS = new Set([
  "opacity", "z-index", "flex", "flex-grow", "flex-shrink", "order", "line-height", "font-weight", "zoom", "column-count", "fill-opacity", "stroke-opacity", "tab-size",
]);

export function toKebab(s: string): string {
  return s.replace(/([A-Z])/g, "-$1").toLowerCase();
}
