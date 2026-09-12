import { ownedKey } from "../resolve/css-props.js";
import type { SubstitutionTarget } from "../system/components.js";
import type { ImportUse } from "../parse/tsx.js";
import type { ComponentManifest, Violation } from "../types.js";
import type { Rule, RuleContext } from "./context.js";

const ID = "component-substitution";

/** Attributes dropped when rewriting a raw element to the system component. */
const STYLING_ATTRS = new Set(["className", "class", "style"]);

/** Imported names that are types or helpers, never a component that could be substituted. */
function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name) && !/Props$/.test(name) && !/^(use[A-Z]|create[A-Z])/.test(name);
}

/** `buttonVariants` -> the Button manifest, when the system has one. */
function componentForVariants(ctx: RuleContext, call: string): ComponentManifest | undefined {
  const base = call.replace(/Variants$/, "");
  const name = base.charAt(0).toUpperCase() + base.slice(1);
  return ctx.components.byName.get(name);
}

export const componentSubstitution: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    if (!ctx.tsx) return out;
    const pkg = ctx.config.system.package;

    // Shadowed imports, one violation per import declaration. Type-only imports and *Props names are not components.
    const byDeclaration = new Map<string, ImportUse[]>();
    for (const imp of ctx.tsx.imports) {
      const key = `${imp.declarationRange.start.line}:${imp.declarationRange.start.col}`;
      byDeclaration.set(key, [...(byDeclaration.get(key) ?? []), imp]);
    }
    for (const imports of byDeclaration.values()) {
      const replaced: { imp: ImportUse; target: SubstitutionTarget }[] = [];
      const remaining: ImportUse[] = [];
      for (const imp of imports) {
        const target = !imp.typeOnly && isComponentName(imp.imported) ? ctx.components.replacementFor(imp.source, imp.imported) : undefined;
        if (target) replaced.push({ imp, target });
        else remaining.push(imp);
      }
      if (replaced.length === 0) continue;
      const first = replaced[0]!;
      const names = [...new Set(replaced.map((r) => r.target.component.name))];
      const systemImport = `import { ${names.join(", ")} } from "${pkg}";`;
      const keep = remaining.length
        ? `import { ${remaining.map((r) => (r.imported === r.local ? r.local : `${r.imported} as ${r.local}`)).join(", ")} } from "${first.imp.source}";\n`
        : "";
      const migration = replaced.map((r) => r.target.migration).filter((m): m is string => !!m).join(" ");
      out.push(
        ctx.report(ID, {
          range: first.imp.declarationRange,
          found: first.imp.declarationSource,
          message: `${first.imp.source} ${replaced.map((r) => r.imp.imported).join(", ")} is shadowed by the system. Use ${names.join(", ")} from ${pkg}.`,
          fix: {
            replace: keep + systemImport,
            confidence: remaining.length ? "nearest" : "exact",
            ...(migration ? { note: `API differs. ${migration}` } : {}),
          },
        }),
      );
    }

    const importedNames = new Set(ctx.tsx.imports.map((i) => i.local));
    for (const el of ctx.tsx.elements) {
      if (!el.isIntrinsic) continue;

      // A raw element styled with the system's own variant function is the system component, minus the component.
      const variantCall = el.attrs.flatMap((a) => a.variantCalls).find((c) => componentForVariants(ctx, c));
      const viaVariants = variantCall ? componentForVariants(ctx, variantCall) : undefined;

      const comp = viaVariants ?? ctx.components.intrinsic.get(el.tag);
      if (!comp) continue;

      const owned = new Set<string>();
      if (!viaVariants) {
        if (!comp.owns) continue;
        for (const use of ctx.classUses) {
          if (use.element !== el || !use.decls) continue;
          for (const d of use.decls) {
            const k = ownedKey(d.prop, comp.owns);
            if (k) owned.add(k);
          }
        }
        for (const attr of el.attrs) {
          for (const sp of attr.styleProps) {
            const k = ownedKey(sp.prop, comp.owns);
            if (k) owned.add(k);
          }
        }
        if (owned.size < 2) continue;
      }

      const kept = el.attrs.filter((a) => !STYLING_ATTRS.has(a.name) && !(el.tag === "button" && a.name === "type"));
      const attrs = kept.map((a) => ` ${a.source}`).join("");
      const replace = el.selfClosing ? `<${comp.name}${attrs} />` : `<${comp.name}${attrs}>${el.childrenSource}</${comp.name}>`;
      const needsImport = !importedNames.has(comp.name);
      out.push(
        ctx.report(ID, {
          range: el.range,
          found: el.openingSource,
          message: viaVariants
            ? `Raw <${el.tag}> styled with ${variantCall}(). Use ${comp.name} from ${pkg}; it applies the same variants and carries the behavior.`
            : `Raw <${el.tag}> styled as a system ${comp.name} (${[...owned].sort().join(", ")}). Use ${comp.name} from ${pkg}.`,
          fix: {
            replace,
            confidence: "nearest",
            note: `${viaVariants ? `Pass the ${variantCall}() arguments as props.` : `Express the removed styling through ${comp.name} props.`}${needsImport ? ` Add: import { ${comp.name} } from "${pkg}";` : ""}`,
          },
        }),
      );
    }

    return out;
  },
};
