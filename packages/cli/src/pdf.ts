/**
 * Markdown to a plain, text-only PDF: the standard fonts, no images, no dependency. Good enough for a report
 * draft that a person reads and edits; the markdown stays the source. Deterministic: the same markdown gives
 * the same bytes, so a recorded run can be compared with a re-run.
 */

const PAGE = { width: 612, height: 792, margin: 54 };
const FONTS = { body: "F1", bold: "F2", mono: "F3" } as const;
type Font = (typeof FONTS)[keyof typeof FONTS];

interface Line {
  font: Font;
  size: number;
  text: string;
  /** Space above the line, in points. */
  gap: number;
}

/** Helvetica averages about half an em per character; Courier is exactly 0.6. */
function charsPerLine(font: Font, size: number, indent = 0): number {
  const width = PAGE.width - 2 * PAGE.margin - indent;
  return Math.floor(width / (size * (font === FONTS.mono ? 0.6 : 0.5)));
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= max) line += " " + word;
    else {
      out.push(line);
      line = word;
    }
    while (line.length > max) {
      out.push(line.slice(0, max));
      line = line.slice(max);
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/** Inline markdown to plain text: the PDF has no links or code spans, so the words are kept and the marks dropped. */
function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function layout(markdown: string): Line[] {
  const lines: Line[] = [];
  const push = (font: Font, size: number, text: string, gap: number, indent = 0, prefix = "") => {
    wrap(text, charsPerLine(font, size, indent) - prefix.length).forEach((t, i) =>
      lines.push({ font, size, text: (i === 0 ? prefix : " ".repeat(prefix.length)) + t, gap: i === 0 ? gap : 0 }),
    );
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      push(FONTS.bold, level === 1 ? 16 : level === 2 ? 13 : 11, plain(heading[2]!), level === 1 ? 0 : 12);
    } else if (/^\|(\s*:?-+:?\s*\|)+$/.test(line)) {
      continue;
    } else if (line.startsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => plain(c.trim()));
      push(FONTS.mono, 8, cells.join(" | "), 2);
    } else if (/^\s*[-*]\s+/.test(line)) {
      const depth = /^\s*/.exec(line)![0].length;
      push(FONTS.body, 10, plain(line.replace(/^\s*[-*]\s+/, "")), 3, 0, " ".repeat(depth) + "- ");
    } else if (line.startsWith(">")) {
      push(FONTS.bold, 10, plain(line.replace(/^>\s?/, "")), 4);
    } else {
      push(FONTS.body, 10, plain(line), 6);
    }
  }
  return lines;
}

/** PDF strings in the standard fonts are WinAnsi: typographic marks become their ASCII forms, the rest a "?". */
function encode(s: string): string {
  const ascii = s
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .replace(/[^\x20-\x7e -ÿ]/g, "?");
  return ascii.replace(/[\\()]/g, (c) => "\\" + c);
}

export function markdownToPdf(markdown: string, title: string, footer: string): Buffer {
  const pages: Line[][] = [[]];
  let y = PAGE.height - PAGE.margin;
  for (const line of layout(markdown)) {
    const step = line.gap + line.size * 1.3;
    if (y - step < PAGE.margin + 24 && pages.at(-1)!.length) {
      pages.push([]);
      y = PAGE.height - PAGE.margin;
    }
    pages.at(-1)!.push(line);
    y -= step;
  }

  const objects: string[] = [];
  const add = (body: string): number => objects.push(body);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // the page tree, filled once the pages have numbers
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  const info = add(`<< /Title (${encode(title)}) /Producer (zengin audit) >>`);

  const kids: number[] = [];
  pages.forEach((page, i) => {
    let at = PAGE.height - PAGE.margin;
    const ops: string[] = [];
    for (const line of page) {
      at -= line.gap + line.size * 1.3;
      ops.push(`BT /${line.font} ${line.size} Tf ${PAGE.margin} ${at.toFixed(1)} Td (${encode(line.text)}) Tj ET`);
    }
    ops.push(`BT /${FONTS.body} 8 Tf ${PAGE.margin} ${PAGE.margin - 18} Td (${encode(`${footer} - page ${i + 1} of ${pages.length}`)}) Tj ET`);
    const stream = ops.join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${content} 0 R >>`),
    );
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
