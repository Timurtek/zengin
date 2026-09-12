/**
 * What the adapter knows about shadcn/ui that cannot be read from a project: which Radix package each
 * component wraps and the props that package's root accepts, which intrinsic element a component stands
 * in for, and sensible defaults for className policy. Everything here is a default the team can edit.
 */

export type PropSpec = { type: "enum" | "boolean" | "string" | "number" | "node" | "function"; values?: string[]; default?: string | boolean | number };

const B: PropSpec = { type: "boolean" };
const F: PropSpec = { type: "function" };
const S: PropSpec = { type: "string" };
const N: PropSpec = { type: "number" };

/** Root props by Radix package suffix (`@radix-ui/react-<suffix>`). */
export const RADIX_ROOT_PROPS: Record<string, Record<string, PropSpec>> = {
  dialog: { open: B, defaultOpen: B, onOpenChange: F, modal: B },
  "alert-dialog": { open: B, defaultOpen: B, onOpenChange: F },
  popover: { open: B, defaultOpen: B, onOpenChange: F, modal: B },
  "dropdown-menu": { open: B, defaultOpen: B, onOpenChange: F, modal: B, dir: { type: "enum", values: ["ltr", "rtl"] } },
  "context-menu": { onOpenChange: F, modal: B, dir: { type: "enum", values: ["ltr", "rtl"] } },
  "hover-card": { open: B, defaultOpen: B, onOpenChange: F, openDelay: N, closeDelay: N },
  tooltip: { open: B, defaultOpen: B, onOpenChange: F, delayDuration: N, disableHoverableContent: B },
  checkbox: { checked: B, defaultChecked: B, onCheckedChange: F, disabled: B, required: B, name: S, value: S },
  switch: { checked: B, defaultChecked: B, onCheckedChange: F, disabled: B, required: B, name: S, value: S },
  toggle: { pressed: B, defaultPressed: B, onPressedChange: F, disabled: B },
  "toggle-group": { type: { type: "enum", values: ["single", "multiple"] }, value: S, defaultValue: S, onValueChange: F, disabled: B, orientation: { type: "enum", values: ["horizontal", "vertical"] } },
  tabs: { value: S, defaultValue: S, onValueChange: F, orientation: { type: "enum", values: ["horizontal", "vertical"], default: "horizontal" }, activationMode: { type: "enum", values: ["automatic", "manual"] } },
  select: { value: S, defaultValue: S, onValueChange: F, open: B, defaultOpen: B, onOpenChange: F, disabled: B, required: B, name: S },
  "radio-group": { value: S, defaultValue: S, onValueChange: F, disabled: B, required: B, name: S, orientation: { type: "enum", values: ["horizontal", "vertical"] } },
  slider: { value: { type: "number" }, defaultValue: { type: "number" }, onValueChange: F, onValueCommit: F, min: N, max: N, step: N, disabled: B, orientation: { type: "enum", values: ["horizontal", "vertical"] } },
  accordion: { type: { type: "enum", values: ["single", "multiple"] }, value: S, defaultValue: S, onValueChange: F, collapsible: B, disabled: B },
  collapsible: { open: B, defaultOpen: B, onOpenChange: F, disabled: B },
  progress: { value: N, max: N },
  separator: { orientation: { type: "enum", values: ["horizontal", "vertical"], default: "horizontal" }, decorative: B },
  avatar: {},
  "aspect-ratio": { ratio: N },
  "scroll-area": { type: { type: "enum", values: ["auto", "always", "scroll", "hover"] }, scrollHideDelay: N },
  label: {},
  menubar: { value: S, defaultValue: S, onValueChange: F },
  "navigation-menu": { value: S, defaultValue: S, onValueChange: F, delayDuration: N, skipDelayDuration: N },
  toast: { open: B, defaultOpen: B, onOpenChange: F, duration: N },
};

/** Intrinsic element a ui file stands in for, by file stem. */
export const INTRINSIC_BY_FILE: Record<string, string> = {
  button: "button",
  input: "input",
  textarea: "textarea",
  label: "label",
  select: "select",
  dialog: "dialog",
  "alert-dialog": "dialog",
  separator: "hr",
  progress: "progress",
  table: "table",
  checkbox: "input",
  "radio-group": "input",
  switch: "input",
  form: "form",
};

/** Headless UI exports the same component replaces, by file stem. */
export const HEADLESS_BY_FILE: Record<string, string[]> = {
  button: ["@headlessui/react#Button"],
  dialog: ["@headlessui/react#Dialog"],
  input: ["@headlessui/react#Input"],
  textarea: ["@headlessui/react#Textarea"],
  label: ["@headlessui/react#Label"],
  checkbox: ["@headlessui/react#Checkbox"],
  switch: ["@headlessui/react#Switch"],
  select: ["@headlessui/react#Select", "@headlessui/react#Listbox"],
  "dropdown-menu": ["@headlessui/react#Menu"],
  popover: ["@headlessui/react#Popover"],
  tabs: ["@headlessui/react#Tabs", "@headlessui/react#TabGroup"],
  "radio-group": ["@headlessui/react#RadioGroup"],
  combobox: ["@headlessui/react#Combobox"],
  command: ["@headlessui/react#Combobox"],
};

export const LAYOUT_ALLOW = ["margin", "width", "height", "flex-item", "grid-item", "position", "display", "overflow"];
export const PLACEMENT_ALLOW = ["margin", "flex-item", "grid-item", "position", "display"];

/** Root props of non-Radix primitives shadcn wraps, by package name. */
export const PACKAGE_ROOT_PROPS: Record<string, Record<string, PropSpec>> = {
  cmdk: { value: S, defaultValue: S, onValueChange: F, filter: F, shouldFilter: B, loop: B, label: S, disablePointerSelection: B, vimBindings: B },
  vaul: { open: B, defaultOpen: B, onOpenChange: F, modal: B, direction: { type: "enum", values: ["top", "bottom", "left", "right"] }, dismissible: B, shouldScaleBackground: B },
  sonner: { position: S, expand: B, richColors: B, closeButton: B, duration: N, theme: { type: "enum", values: ["light", "dark", "system"] } },
};

/** Overlays and menus: className is not a styling API. Inline controls: placement only. Everything else: layout. */
const OVERLAYS = new Set(["dialog", "alert-dialog", "sheet", "drawer", "popover", "tooltip", "hover-card", "dropdown-menu", "context-menu", "menubar", "navigation-menu", "select", "command", "combobox", "toast", "toaster", "sonner"]);
const INLINE = new Set(["badge", "checkbox", "switch", "toggle", "radio-group", "avatar", "label"]);

export function defaultAllow(stem: string): string[] {
  if (OVERLAYS.has(stem)) return [];
  if (INLINE.has(stem)) return PLACEMENT_ALLOW;
  return LAYOUT_ALLOW;
}

/**
 * Tailwind utility prefix -> the CSS property family a component "owns" when its cva base or variants
 * set it. Text color and text size share the `text-` prefix; sizes are the named steps.
 */
const TEXT_SIZES = new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]);

export function ownedPropertyOf(utility: string): string | undefined {
  const base = utility.replace(/^[^:]*:/g, "").replace(/^!/, "");
  if (/^bg-/.test(base)) return "background-color";
  if (/^text-/.test(base)) return TEXT_SIZES.has(base.slice(5)) || /^text-\[[\d.]+(px|rem|em)\]$/.test(base) ? "font" : "color";
  if (/^(font-|leading-|tracking-)/.test(base)) return "font";
  if (/^border(-[trblxy])?(-|$)/.test(base) && !/^border(-[trblxy])?(-\d+)?$/.test(base)) return "border-color";
  if (/^(p|px|py|pt|pr|pb|pl|ps|pe)-/.test(base)) return "padding";
  if (/^h-/.test(base)) return "height";
  if (/^rounded/.test(base)) return "border-radius";
  if (/^shadow/.test(base)) return "box-shadow";
  return undefined;
}

export function pascal(stem: string): string {
  return stem.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}
