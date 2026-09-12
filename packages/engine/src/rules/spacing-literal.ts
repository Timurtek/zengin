import { offsetsToRange } from "../parse/css.js";
import { findLengthLiterals, isSpacingProp, rewriteAll, tokenUtilityPrefix } from "../resolve/css-props.js";
import type { Fix, Token, Violation } from "../types.js";
import { rewriteKey, utilityUses, type ClassUse, type Rule, type RuleContext } from "./context.js";

const ID = "spacing-literal";

/** Tailwind's default multiplier scale: `calc(var(--spacing) * 3.5)` at the default 0.25rem base. */
const DEFAULT_SCALE = /calc\(var\(--spacing\)\s*\*\s*(-?[\d.]+)\)/;

interface Match {
  px: number;
  token?: Token;
  confidence: Fix["confidence"];
  note?: string;
}

function match(ctx: RuleContext, literal: string): Match | undefined {
  const m = ctx.tokens.matchSpacing(literal);
  if (m.px === undefined) return undefined;
  if (m.exact) return { px: m.px, token: m.exact, confidence: "exact" };
  const neighbours = [m.below, m.above].filter((s): s is NonNullable<typeof s> => s !== undefined);
  if (neighbours.length === 0) return { px: m.px, confidence: "none" };
  const closest = neighbours.reduce((a, b) => (Math.abs(b.px - m.px!) < Math.abs(a.px - m.px!) ? b : a));
  return {
    px: m.px,
    token: closest.token,
    confidence: "nearest",
    note: neighbours.map((s) => `${s.token.name} = ${s.px}px`).join(", "),
  };
}

export const spacingLiteral: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];

    for (const use of utilityUses(ctx)) {
      if (!use.decls) continue;
      const decl = use.decls.find((d) => isSpacingProp(d.prop));
      if (!decl) continue;

      const lit = findLengthLiterals(decl.value)[0];
      if (lit) {
        const m = match(ctx, lit.literal);
        if (m) out.push(reportClass(ctx, use, m, `Arbitrary spacing value. ${m.px}px is not on the spacing scale.`));
        continue;
      }
      const scale = DEFAULT_SCALE.exec(decl.value);
      if (scale) {
        const px = Number(scale[1]) * 4;
        if (px === 0) continue;
        const m = match(ctx, `${px}px`);
        if (m && m.confidence !== "exact") {
          out.push(reportClass(ctx, use, m, `${use.candidate} resolves to the Tailwind default spacing scale (${px}px), not the system scale.`));
        }
      }
    }

    for (const el of ctx.tsx?.elements ?? []) {
      for (const attr of el.attrs) {
        for (const sp of attr.styleProps) {
          if (!isSpacingProp(sp.prop)) continue;
          const lits = findLengthLiterals(sp.value);
          if (lits.length === 0) continue;
          // One violation per property. The fix rewrites every literal in the value, so applying it
          // once leaves nothing behind; confidence is the weakest of the individual matches.
          const matches = lits.map((l) => ({ lit: l, m: match(ctx, l.literal) }));
          const offScale = matches.filter((x) => x.m && x.m.confidence !== "exact");
          const worst = offScale[0]?.m ?? matches[0]!.m;
          if (!worst) continue;
          const replaceable = matches.every((x) => x.m?.token);
          const rewritten = replaceable ? rewriteAll(sp.value, matches.map((x) => ({ literal: x.lit.literal, offset: x.lit.offset, cssVar: x.m!.token!.cssVar }))) : null;
          const px = offScale[0]?.m?.px ?? worst.px;
          out.push(
            ctx.report(ID, {
              range: sp.valueRange,
              found: sp.source,
              message: offScale.length
                ? `Arbitrary spacing value in inline style (${sp.prop}). ${px}px is not on the spacing scale.`
                : `Spacing literal in inline style (${sp.prop}) where a token reference is required. ${px}px matches ${worst.token!.name} but will not follow scale changes.`,
              fix: fixFor(worst, rewritten ? JSON.stringify(rewritten) : null),
            }),
          );
        }
      }
    }

    for (const decl of ctx.css?.decls ?? []) {
      if (!isSpacingProp(decl.prop)) continue;
      for (const lit of findLengthLiterals(decl.value)) {
        const m = match(ctx, lit.literal);
        if (!m) continue;
        const start = decl.valueOffset + lit.offset;
        out.push(
          ctx.report(ID, {
            range: offsetsToRange(ctx.file.content, start, start + lit.literal.length),
            found: lit.literal,
            message: m.confidence === "exact"
              ? `Spacing literal where a token reference is required. ${m.px}px matches ${m.token!.name} but will not follow scale changes.`
              : `Arbitrary spacing value. ${m.px}px is not on the spacing scale.`,
            fix: fixFor(m, m.token ? `var(${m.token.cssVar})` : null),
          }),
        );
      }
    }

    return out;
  },
};

function fixFor(m: Match, replace: string | null): Fix {
  return {
    replace,
    confidence: replace ? m.confidence : "none",
    ...(m.token ? { token: m.token.name } : {}),
    ...(m.note ? { note: m.note } : {}),
  };
}

function reportClass(ctx: RuleContext, use: ClassUse, m: Match, message: string): Violation {
  const prefix = tokenUtilityPrefix(use.base);
  let replace: string | null = null;
  if (m.token && prefix) {
    const candidate = rewriteKey(use, prefix, m.token.key);
    if (ctx.resolver.resolve(candidate)) replace = candidate;
  }
  return ctx.report(ID, { range: use.range, found: use.candidate, message, fix: fixFor(m, replace) });
}
