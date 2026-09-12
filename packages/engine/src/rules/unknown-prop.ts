import type { Violation } from "../types.js";
import { nearest, quoteList } from "../util/strings.js";
import type { Rule } from "./context.js";

const ID = "unknown-prop";

/** Props every React element accepts, regardless of the manifest. */
const ALWAYS = new Set([
  "className", "class", "style", "children", "key", "ref", "id", "role", "tabIndex", "title", "hidden", "slot", "lang", "dir", "dangerouslySetInnerHTML",
  "suppressHydrationWarning", "suppressContentEditableWarning",
]);
const ALWAYS_RE = /^(on[A-Z]|aria-|data-)/;

/**
 * The React DOM attribute set for elements a component may `extends`. Global attributes apply to every
 * element; element-specific ones are added by tag. Kept complete on purpose: an incomplete list here
 * produces false positives on ordinary HTML, which is the most expensive kind of noise.
 */
const GLOBAL = [
  "accessKey", "autoCapitalize", "autoCorrect", "autoFocus", "autoSave", "contentEditable", "contextMenu", "draggable", "enterKeyHint", "inputMode", "is", "itemID", "itemProp",
  "itemRef", "itemScope", "itemType", "nonce", "popover", "popoverTarget", "popoverTargetAction", "spellCheck", "translate", "unselectable", "part", "exportparts", "inert",
];

const BY_TAG: Record<string, string[]> = {
  button: ["type", "disabled", "name", "value", "form", "formAction", "formEncType", "formMethod", "formNoValidate", "formTarget", "popovertarget"],
  a: ["href", "target", "rel", "download", "hrefLang", "media", "ping", "referrerPolicy", "type"],
  input: [
    "type", "name", "value", "defaultValue", "placeholder", "disabled", "required", "readOnly", "autoComplete", "min", "max", "step", "pattern", "checked", "defaultChecked",
    "maxLength", "minLength", "size", "list", "multiple", "accept", "alt", "src", "width", "height", "capture", "form", "formAction", "formEncType", "formMethod", "formNoValidate",
    "formTarget", "dirName",
  ],
  textarea: ["name", "value", "defaultValue", "placeholder", "disabled", "required", "readOnly", "rows", "cols", "maxLength", "minLength", "wrap", "autoComplete", "form", "dirName"],
  select: ["name", "value", "defaultValue", "disabled", "required", "multiple", "size", "autoComplete", "form"],
  option: ["value", "disabled", "selected", "label"],
  label: ["htmlFor", "form"],
  form: ["action", "method", "encType", "target", "noValidate", "autoComplete", "name", "acceptCharset"],
  dialog: ["open"],
  details: ["open", "name"],
  img: ["src", "alt", "width", "height", "loading", "decoding", "srcSet", "sizes", "crossOrigin", "referrerPolicy", "useMap", "fetchPriority"],
  video: ["src", "poster", "width", "height", "controls", "autoPlay", "loop", "muted", "playsInline", "preload", "crossOrigin"],
  audio: ["src", "controls", "autoPlay", "loop", "muted", "preload", "crossOrigin"],
  iframe: ["src", "srcDoc", "width", "height", "allow", "allowFullScreen", "loading", "name", "referrerPolicy", "sandbox"],
  table: ["cellPadding", "cellSpacing", "summary"],
  td: ["colSpan", "rowSpan", "headers", "scope"],
  th: ["colSpan", "rowSpan", "headers", "scope", "abbr"],
  ol: ["start", "reversed", "type"],
  li: ["value"],
  progress: ["value", "max"],
  meter: ["value", "min", "max", "low", "high", "optimum"],
  time: ["dateTime"],
  canvas: ["width", "height"],
  svg: ["viewBox", "width", "height", "fill", "stroke", "xmlns", "preserveAspectRatio"],
};

export const unknownProp: Rule = {
  id: ID,
  check(ctx) {
    const out: Violation[] = [];
    for (const [el, comp] of ctx.systemElements) {
      if (el.tag.includes(".")) continue; // sub-parts are not contracted yet
      const known = Object.keys(comp.props ?? {});
      // An uncontracted component (no declared props beyond asChild, nothing extended) cannot call a prop unknown.
      if (!comp.extends && known.filter((k) => k !== "asChild").length === 0) continue;
      const passthrough = new Set([...ALWAYS, ...(comp.extends ? [...GLOBAL, ...(BY_TAG[comp.extends] ?? [])] : [])]);
      for (const attr of el.attrs) {
        if (known.includes(attr.name) || passthrough.has(attr.name) || ALWAYS_RE.test(attr.name)) continue;
        const near = nearest(attr.name, known, 2);
        out.push(
          ctx.report(ID, {
            range: attr.range,
            found: attr.source,
            message: `${comp.name} has no prop "${attr.name}".${known.length ? ` Props: ${quoteList(known)}.` : comp.extends ? ` It passes <${comp.extends}> attributes through and declares no props of its own.` : ""}`,
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
