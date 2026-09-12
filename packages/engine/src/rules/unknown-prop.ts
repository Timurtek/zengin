import type { Violation } from "../types.js";
import { nearest, quoteList } from "../util/strings.js";
import type { Rule } from "./context.js";

const ID = "unknown-prop";

/** Props every React element accepts, regardless of the manifest. */
const ALWAYS = new Set([
  "className", "class", "style", "children", "key", "ref", "id", "role", "tabIndex", "title", "hidden", "slot", "lang", "dir", "dangerouslySetInnerHTML",
]);
const ALWAYS_RE = /^(on[A-Z]|aria-|data-)/;

/** Attributes that pass through when a component `extends` an intrinsic element. */
const EXTENDS: Record<string, string[]> = {
  button: ["type", "disabled", "name", "value", "form", "formAction", "autoFocus"],
  a: ["href", "target", "rel", "download", "hrefLang"],
  input: ["type", "name", "value", "defaultValue", "placeholder", "disabled", "required", "readOnly", "autoComplete", "autoFocus", "min", "max", "step", "pattern", "checked", "defaultChecked", "maxLength", "minLength", "inputMode", "form"],
  textarea: ["name", "value", "defaultValue", "placeholder", "disabled", "required", "readOnly", "rows", "cols", "maxLength", "minLength", "autoFocus", "form"],
  select: ["name", "value", "defaultValue", "disabled", "required", "multiple", "autoFocus", "form"],
  dialog: ["open"],
  label: ["htmlFor", "form"],
  img: ["src", "alt", "width", "height", "loading", "decoding", "srcSet", "sizes"],
};

export const unknownProp: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    for (const [el, comp] of ctx.systemElements) {
      if (el.tag.includes(".")) continue; // sub-parts are not contracted yet
      const known = Object.keys(comp.props ?? {});
      const passthrough = new Set([...ALWAYS, ...(comp.extends ? EXTENDS[comp.extends] ?? [] : [])]);
      for (const attr of el.attrs) {
        if (known.includes(attr.name) || passthrough.has(attr.name) || ALWAYS_RE.test(attr.name)) continue;
        const near = nearest(attr.name, known, 2);
        out.push(
          ctx.report(ID, {
            range: attr.range,
            found: attr.source,
            message: `${comp.name} has no prop "${attr.name}". Props: ${quoteList(known)}.`,
            fix: {
              replace: near ? attr.source.replace(new RegExp(`^${attr.name}`), near) : null,
              confidence: near ? "nearest" : "none",
            },
          }),
        );
      }
    }
    return out;
  },
};
