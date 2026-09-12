import type { Pos, Range } from "../types.js";

/** Converts byte offsets into 1-based line/column positions. */
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(content: string) {
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) this.starts.push(i + 1);
    }
  }

  pos(offset: number): Pos {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - this.starts[lo]! + 1 };
  }

  range(start: number, end: number): Range {
    return { start: this.pos(start), end: this.pos(end) };
  }
}

export function comparePos(a: Pos, b: Pos): number {
  return a.line - b.line || a.col - b.col;
}
