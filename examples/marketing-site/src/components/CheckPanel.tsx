import { Badge, Button } from "@zenginui/ui";
import { useState } from "react";
import sample from "../data/sample.json";

type Violation = (typeof sample.violations)[number];

const TONE: Record<string, "danger" | "warning" | "primary"> = { error: "danger", warn: "warning", info: "primary" };

/**
 * The hero's thesis: a file an agent might write, what the engine says about it, and the file after the
 * fixes. The source and the findings are real engine output (demo/sample/run.mjs), not copy.
 */
export function CheckPanel() {
  const [fixed, setFixed] = useState(false);
  const before = sample.before.split("\n");
  const after = sample.after.split("\n");
  const lines = fixed ? after : before;
  const flagged = new Set(sample.violations.map((v) => v.line));
  const changed = new Set(after.map((l, i) => (l !== before[i] ? i + 1 : 0)).filter(Boolean));

  return (
    <div className="check" aria-label="Zengin checking a file">
      <div className="check__bar">
        <span>{sample.file}</span>
        <Badge tone={fixed ? "success" : "danger"} size="sm">
          {fixed ? "0 violations" : `${sample.violations.length} violations`}
        </Badge>
        <div className="check__bar-actions">
          <Button size="sm" variant={fixed ? "soft" : "solid"} tone="primary" onClick={() => setFixed((f) => !f)} aria-pressed={fixed}>
            {fixed ? "Show the original" : `Apply ${sample.violations.length} fixes`}
          </Button>
        </div>
      </div>

      {/* A line-numbered view with flagged rows, which is a table of lines rather than a code block. */}
      <div className="check__code" role="region" aria-label="File contents" tabIndex={0}>
        {lines.map((text, i) => (
          <div key={i} className="check__line" data-flagged={!fixed && flagged.has(i + 1) ? "true" : undefined} data-changed={fixed && changed.has(i + 1) ? "true" : undefined}>
            <span className="check__lineno">{i + 1}</span>
            <code>{text || " "}</code>
          </div>
        ))}
      </div>

      {fixed ? (
        <p className="check__clean">
          <Badge tone="success">Clean</Badge>
          Every value is a token or a prop now. The same file checked again: nothing to report.
        </p>
      ) : (
        <ul className="check__findings">
          {sample.violations.map((v, i) => (
            <Finding key={i} v={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Finding({ v }: { v: Violation }) {
  return (
    <li className="check__finding">
      <span className="check__finding-line">{v.line}</span>
      <div className="check__finding-head">
        <Badge tone={TONE[v.severity] ?? "neutral"} size="sm">
          {v.rule}
        </Badge>
        <Badge variant="outline" size="sm">
          {v.fix.confidence}
        </Badge>
      </div>
      <p className="check__finding-message">{v.message}</p>
      {v.fix.replace && (
        <p className="check__fix">
          <del>{shorten(v.found)}</del>
          <ins>{shorten(v.fix.replace)}</ins>
        </p>
      )}
    </li>
  );
}

function shorten(s: string): string {
  return s.length > 48 ? `${s.slice(0, 45)}...` : s;
}
