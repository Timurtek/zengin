import { categoryOf, ownedKey } from "../resolve/css-props.js";
import type { ComponentManifest, Violation } from "../types.js";
import { quoteList } from "../util/strings.js";
import type { Rule } from "./context.js";

const ID = "classname-policy";

/** Utilities that hide or reveal content for assistive technology. They set many properties and restyle nothing. */
const ACCESSIBILITY_UTILITIES = new Set(["sr-only", "not-sr-only"]);

function reason(comp: ComponentManifest, prop: string): string {
  const key = ownedKey(prop, comp.owns);
  const control = key ? comp.owns?.[key] : undefined;
  const props = typeof control === "string" ? [control] : (control ?? []);
  if (key && props.length) return `${key} is owned by the ${props.join(" and ")} prop${props.length > 1 ? "s" : ""}.`;
  if (key) return `${key} is owned by the component; use a variant or a token.`;
  return `className on ${comp.name} is limited to: ${quoteList(comp.className?.allow ?? [])}.`;
}

export const classnamePolicy: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    for (const [el, comp] of ctx.systemElements) {
      if (el.tag.includes(".")) continue;
      const allow = comp.className?.allow ?? [];

      for (const use of ctx.classUses) {
        if (use.element !== el || !use.decls) continue;
        if (ACCESSIBILITY_UTILITIES.has(use.base)) continue; // visually-hidden is not a styling decision
        const denied = [...new Set(use.decls.map((d) => d.prop))].filter((p) => !allow.includes(categoryOf(p)));
        if (denied.length === 0) continue;
        out.push(
          ctx.report(ID, {
            range: use.range,
            found: use.candidate,
            message: `className on ${comp.name} may not set ${quoteList(denied)}${use.origin ? ` (.${use.candidate} in ${use.origin})` : ""}. ${reason(comp, denied[0]!)}`,
            fix: { replace: null, confidence: "none" },
          }),
        );
      }

      for (const attr of el.attrs) {
        for (const sp of attr.styleProps) {
          if (allow.includes(categoryOf(sp.prop))) continue;
          out.push(
            ctx.report(ID, {
              range: sp.range,
              found: sp.source,
              message: `style on ${comp.name} may not set ${sp.prop}. ${reason(comp, sp.prop)}`,
              fix: { replace: null, confidence: "none" },
            }),
          );
        }
      }
    }
    return out;
  },
};
