import postcss from "postcss";
import type { Range } from "../types.js";
import type { Comment } from "./tsx.js";

export interface CssDecl {
  prop: string;
  value: string;
  range: Range;
  valueRange: Range;
  /** Byte offset of the first character of the value in the file. */
  valueOffset: number;
}

export interface CssFile {
  decls: CssDecl[];
  /** Custom properties defined in this file, e.g. `--panel-bg`. */
  definedVars: Set<string>;
  comments: Comment[];
}

export function parseCss(content: string): CssFile {
  const root = postcss.parse(content);
  const file: CssFile = { decls: [], definedVars: new Set(), comments: [] };

  root.walkDecls((decl) => {
    if (!decl.source?.start || !decl.source.end) return;
    if (decl.prop.startsWith("--")) file.definedVars.add(decl.prop);
    const start = decl.source.start;
    const end = decl.source.end;
    // postcss end column is inclusive; convert to exclusive.
    const range: Range = { start: { line: start.line, col: start.column }, end: { line: end.line, col: end.column + 1 } };
    const declSource = content.slice(start.offset, end.offset + 1);
    const valueIdx = declSource.indexOf(decl.value, decl.prop.length);
    const valueOffset = valueIdx === -1 ? start.offset : start.offset + valueIdx;
    const valueRange = valueIdx === -1 ? range : offsetsToRange(content, valueOffset, valueOffset + decl.value.length);
    file.decls.push({ prop: decl.prop, value: decl.value, range, valueRange, valueOffset });
  });

  root.walkComments((c) => {
    if (!c.source?.start || !c.source.end) return;
    file.comments.push({ text: c.text.trim(), line: c.source.start.line, endLine: c.source.end.line });
  });

  return file;
}

export function offsetsToRange(content: string, start: number, end: number): Range {
  return { start: offsetToPos(content, start), end: offsetToPos(content, end) };
}

function offsetToPos(content: string, offset: number): { line: number; col: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: offset - lineStart + 1 };
}
