import { offsetsToRange } from "../parse/css.js";
import { findVarRefs, isColorProp, isSpacingProp, tokenUtilityPrefix } from "../resolve/css-props.js";
import type { Violation } from "../types.js";
import { nearest } from "../util/strings.js";
import { rewriteKey, varNamespace, type Rule, type RuleContext } from "./context.js";

const ID = "token-reference";

/** Nearest system token key in a namespace by edit distance, or across all namespaces when none is given. */
function nearestKey(ctx: RuleContext, key: string, namespace?: string): { key: string; name: string } | undefined {
  const pool = ctx.tokens.tokens.filter((t) => t.key && (!namespace || t.namespace === namespace));
  const hit = nearest(key, pool.map((t) => t.key), 2);
  if (!hit) return undefined;
  const token = pool.find((t) => t.key === hit)!;
  return { key: token.key, name: token.name };
}

export const tokenReference: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];

    for (const use of ctx.classUses) {
      if (use.source === "stylesheet") continue; // the project defines it; its literals are checked in the stylesheet
      const prefix = tokenUtilityPrefix(use.base);
      if (!prefix) continue;

      if (!use.decls) {
        if (!ctx.resolver.utilities) continue; // without a class compiler an unknown class is just a class
        const key = use.base.slice(prefix.length + 1);
        const near = nearestKey(ctx, key);
        const candidate = near ? rewriteKey(use, prefix, near.key) : undefined;
        const replace = candidate && ctx.resolver.resolve(candidate) ? candidate : null;
        out.push(
          ctx.report(ID, {
            range: use.range,
            found: use.candidate,
            message: `No token matches "${use.candidate}".`,
            fix: { replace, confidence: replace ? "nearest" : "none", ...(replace && near ? { token: near.name } : {}) },
          }),
        );
        continue;
      }

      // Compiled against the Tailwind default theme in a namespace the system has its own tokens for.
      for (const d of use.decls) {
        if (isColorProp(d.prop) || isSpacingProp(d.prop)) continue; // color-literal and spacing-literal own these
        const ref = findVarRefs(d.value).find((r) => {
          if (ctx.tokens.byVar.has(r.literal) || !ctx.resolver.defaultVars.has(r.literal)) return false;
          if (r.literal === "--spacing") return false; // width/height on the default multiplier scale is layout, not a token
          // Derived variables such as `--text-lg--line-height` belong to the token they hang off.
          const split = r.literal.lastIndexOf("--");
          if (split > 0 && ctx.tokens.byVar.has(r.literal.slice(0, split))) return false;
          const ns = varNamespace(r.literal);
          return ctx.tokens.namespaces.has(ns) && !ctx.tokens.extendedNamespaces.has(ns);
        });
        if (!ref) continue;
        const ns = varNamespace(ref.literal);
        const key = ref.literal.slice(ns.length + 3);
        const near = nearestKey(ctx, key, ns);
        const candidate = near ? rewriteKey(use, prefix, near.key) : undefined;
        const replace = candidate && ctx.resolver.resolve(candidate) ? candidate : null;
        out.push(
          ctx.report(ID, {
            range: use.range,
            found: use.candidate,
            message: `${use.candidate} references Tailwind's default ${ref.literal}; the system defines no such ${ns} token.`,
            fix: { replace, confidence: replace ? "nearest" : "none", ...(replace && near ? { token: near.name } : {}) },
          }),
        );
        break;
      }
    }

    for (const el of ctx.tsx?.elements ?? []) {
      for (const attr of el.attrs) {
        for (const sp of attr.styleProps) {
          const ref = findVarRefs(sp.value).find((r) => isUnknownSystemVar(ctx, r.literal));
          if (!ref) continue;
          const near = nearestVar(ctx, ref.literal);
          out.push(
            ctx.report(ID, {
              range: sp.valueRange,
              found: JSON.stringify(sp.value),
              message: `Unknown token ${ref.literal} in inline style (${sp.prop}).`,
              fix: {
                replace: near ? JSON.stringify(sp.value.replace(ref.literal, near.cssVar)) : null,
                confidence: near ? "nearest" : "none",
                ...(near ? { token: near.name } : {}),
              },
            }),
          );
        }
      }
    }

    for (const decl of ctx.css?.decls ?? []) {
      for (const ref of findVarRefs(decl.value)) {
        if (!isUnknownSystemVar(ctx, ref.literal) || ctx.css!.definedVars.has(ref.literal)) continue;
        const near = nearestVar(ctx, ref.literal);
        const start = decl.valueOffset + ref.offset;
        out.push(
          ctx.report(ID, {
            range: offsetsToRange(ctx.file.content, start, start + ref.literal.length),
            found: ref.literal,
            message: `Unknown token ${ref.literal}.`,
            fix: { replace: near ? near.cssVar : null, confidence: near ? "nearest" : "none", ...(near ? { token: near.name } : {}) },
          }),
        );
      }
    }

    return out;
  },
};

/** A custom property in a namespace the system defines tokens for, that is not one of those tokens. */
function isUnknownSystemVar(ctx: RuleContext, v: string): boolean {
  return !ctx.tokens.byVar.has(v) && ctx.tokens.namespaces.has(varNamespace(v));
}

function nearestVar(ctx: RuleContext, v: string) {
  const ns = varNamespace(v);
  const pool = ctx.tokens.tokens.filter((t) => t.namespace === ns);
  const hit = nearest(v, pool.map((t) => t.cssVar), 3);
  return hit ? pool.find((t) => t.cssVar === hit) : undefined;
}
