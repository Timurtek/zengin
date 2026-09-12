import { offsetsToRange } from "../parse/css.js";
import { findColorLiterals, findVarRefs, isColorProp, rewriteAll, tokenUtilityPrefix } from "../resolve/css-props.js";
import type { Token, Fix, Violation } from "../types.js";
import { rewriteKey, utilityUses, type ClassUse, type Rule, type RuleContext } from "./context.js";

const ID = "color-literal";

interface Match {
  message: string;
  token?: Token;
  confidence: Fix["confidence"];
  candidates?: string[];
  note?: string;
}

/** What the engine knows about a color value relative to the token set. */
function describe(ctx: RuleContext, literal: string): Match {
  const exact = ctx.tokens.exactColors(literal);
  if (exact.length === 1) {
    return {
      message: `Color literal where a token reference is required. The value matches ${exact[0]!.name} in the default theme but will not follow theme changes.`,
      token: exact[0],
      confidence: "exact",
    };
  }
  if (exact.length > 1) {
    const names = exact.map((t) => t.name);
    return {
      message: `Color literal where a token reference is required. The value matches ${names.length} tokens (${names.join(", ")}) in the default theme but will not follow theme changes.`,
      token: exact[0],
      confidence: "nearest",
      candidates: names,
      note: `Several tokens share this value. Pick by role: ${names.join(", ")}.`,
    };
  }
  const near = ctx.tokens.nearestColor(literal);
  if (near) {
    return {
      message: `Color literal where a token reference is required. ${literal} has no exact token match.`,
      token: near,
      confidence: "nearest",
      note: `Nearest by value: ${near.name} = ${near.value}. Verify the semantic role before applying.`,
    };
  }
  return { message: `Color literal where a token reference is required. ${literal} could not be matched to a token.`, confidence: "none" };
}

function fixFor(m: Match, replace: string | null): Fix {
  return {
    replace,
    confidence: replace ? m.confidence : "none",
    ...(replace && m.token ? { token: m.token.name } : {}),
    ...(replace && m.candidates ? { candidates: m.candidates } : {}),
    ...(replace && m.note ? { note: m.note } : {}),
  };
}

/** A class-level fix: rewrite the utility's key to the token's key, only if the result actually compiles. */
function classFix(ctx: RuleContext, use: ClassUse, m: Match): Fix {
  const prefix = tokenUtilityPrefix(use.base);
  let replace: string | null = null;
  if (m.token && prefix) {
    const candidate = rewriteKey(use, prefix, m.token.key);
    if (ctx.resolver.resolve(candidate)) replace = candidate;
  }
  return fixFor(m, replace);
}

export const colorLiteral: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    const allowPalette = ctx.config.rules[ID].allow === "palette";

    for (const use of utilityUses(ctx)) {
      if (!use.decls) continue;
      const colorDecls = use.decls.filter((d) => isColorProp(d.prop));
      if (colorDecls.length === 0) continue;

      const literal = colorDecls.flatMap((d) => findColorLiterals(d.value))[0];
      if (literal) {
        const m = describe(ctx, literal.literal);
        out.push(ctx.report(ID, { range: use.range, found: use.candidate, message: m.message, fix: classFix(ctx, use, m) }));
        continue;
      }
      if (allowPalette) continue;
      const palette = colorDecls
        .flatMap((d) => findVarRefs(d.value))
        .find((r) => !ctx.tokens.byVar.has(r.literal) && ctx.resolver.defaultVars.has(r.literal) && r.literal.startsWith("--color-"));
      if (palette) {
        const value = ctx.resolver.defaultVarValues.get(palette.literal) ?? "";
        const m = describe(ctx, value);
        out.push(
          ctx.report(ID, {
            range: use.range,
            found: use.candidate,
            message: `${use.candidate} references the Tailwind default palette (${palette.literal}), not a system token.`,
            fix: classFix(ctx, use, m),
          }),
        );
      }
    }

    for (const el of ctx.tsx?.elements ?? []) {
      for (const attr of el.attrs) {
        for (const sp of attr.styleProps) {
          if (!isColorProp(sp.prop)) continue;
          const lits = findColorLiterals(sp.value);
          if (lits.length === 0) continue;
          // One violation per property; the fix rewrites every literal in the value at once.
          const matches = lits.map((l) => ({ lit: l, m: describe(ctx, l.literal) }));
          const worst = matches.find((x) => x.m.confidence === "none")?.m ?? matches.find((x) => x.m.confidence === "nearest")?.m ?? matches[0]!.m;
          const replaceable = matches.every((x) => x.m.token);
          const rewritten = replaceable ? rewriteAll(sp.value, matches.map((x) => ({ literal: x.lit.literal, offset: x.lit.offset, cssVar: x.m.token!.cssVar }))) : null;
          out.push(
            ctx.report(ID, {
              range: sp.valueRange,
              found: JSON.stringify(sp.value),
              message: worst.message.replace("Color literal", `Color literal in inline style (${sp.prop})`),
              fix: fixFor(worst, rewritten ? JSON.stringify(rewritten) : null),
            }),
          );
        }
      }
    }

    for (const decl of ctx.css?.decls ?? []) {
      if (!isColorProp(decl.prop)) continue;
      for (const lit of findColorLiterals(decl.value)) {
        const m = describe(ctx, lit.literal);
        const start = decl.valueOffset + lit.offset;
        out.push(
          ctx.report(ID, {
            range: offsetsToRange(ctx.file.content, start, start + lit.literal.length),
            found: lit.literal,
            message: m.message,
            fix: fixFor(m, m.token ? `var(${m.token.cssVar})` : null),
          }),
        );
      }
    }

    return out;
  },
};
