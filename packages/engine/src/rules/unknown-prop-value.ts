import { compareVersions } from "../config.js";
import type { PropManifest, Violation } from "../types.js";
import { nearest, quoteList } from "../util/strings.js";
import type { Rule, RuleContext } from "./context.js";

const ID = "unknown-prop-value";

export const unknownPropValue: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    const version = ctx.config.system.version;

    for (const [el, comp] of ctx.systemElements) {
      if (el.tag.includes(".")) continue;
      for (const attr of el.attrs) {
        const prop = comp.props?.[attr.name];
        if (!prop || prop.type !== "enum" || !prop.values || attr.stringValue === undefined) continue;
        const value = attr.stringValue;

        if (!prop.values.includes(value)) {
          const decomposed = decompose(ctx, comp.props!, attr.name, value);
          const near = nearest(value, prop.values, 2);
          out.push(
            ctx.report(ID, {
              range: attr.range,
              found: attr.source,
              message: `${comp.name} has no ${attr.name} "${value}". Valid: ${quoteList(prop.values)}.`,
              fix: decomposed
                ? { replace: decomposed.replace, confidence: "nearest", note: decomposed.note }
                : { replace: near ? `${attr.name}="${near}"` : null, confidence: near ? "nearest" : "none" },
            }),
          );
          continue;
        }

        const since = prop.valuesSince?.[value];
        if (since && compareVersions(since, version) > 0) {
          const available = prop.values.filter((v) => {
            const s = prop.valuesSince?.[v];
            return !s || compareVersions(s, version) <= 0;
          });
          const adjacent = adjacentAvailable(prop.values, available, value);
          out.push(
            ctx.report(ID, {
              range: attr.range,
              found: attr.source,
              message: `${comp.name} ${attr.name} "${value}" was added in ${ctx.config.system.package} ${since}. This project pins ${version}. Valid here: ${quoteList(available)}.`,
              fix: { replace: adjacent ? `${attr.name}="${adjacent}"` : null, confidence: adjacent ? "nearest" : "none" },
            }),
          );
        }
      }
    }
    return out;
  },
};

/**
 * `variant="ghost-danger"` -> `variant="ghost" tone="danger"` when every segment is a value of some enum prop.
 * Deterministic: segments are matched in order against the props in manifest order.
 */
function decompose(
  _ctx: RuleContext,
  props: Record<string, PropManifest>,
  attrName: string,
  value: string,
): { replace: string; note: string } | undefined {
  const parts = value.split(/[-_]/);
  if (parts.length < 2) return undefined;
  const assignments: { prop: string; value: string }[] = [];
  for (const part of parts) {
    const owner = Object.entries(props).find(([name, p]) => p.type === "enum" && p.values?.includes(part) && !assignments.some((a) => a.prop === name));
    if (!owner) return undefined;
    assignments.push({ prop: owner[0], value: part });
  }
  const others = assignments.filter((a) => a.prop !== attrName);
  return {
    replace: assignments.map((a) => `${a.prop}="${a.value}"`).join(" "),
    note: others.map((a) => `"${a.value}" is a value of the ${a.prop} prop.`).join(" "),
  };
}

/** The nearest available value by position in the manifest's value order, looking down first. */
function adjacentAvailable(values: string[], available: string[], value: string): string | undefined {
  const idx = values.indexOf(value);
  for (let d = 1; d < values.length; d++) {
    const below = values[idx - d];
    if (below && available.includes(below)) return below;
    const above = values[idx + d];
    if (above && available.includes(above)) return above;
  }
  return undefined;
}
