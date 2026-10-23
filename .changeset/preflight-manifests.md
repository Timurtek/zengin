---
"@zenginui/engine": minor
"@zenginui/adapter-css": minor
---

Manifests say what a component's types say, found in preflights on Comp, Dub and Sim, where most remaining `unknown-prop` hits were reader gaps:

- **`Omit<…, "className">` is on record.** A component whose props type omits a prop (and does not declare it again) carries it in the manifest's new `omits`. `unknown-prop` reports passing it, even on a component with passthrough types ("Button does not take className: its props type omits it"), and `classname-policy` leaves that component's className to it. `ref` and `key` never count: `forwardRef` gives `ref` back.
- **React's helpers are React's** whether React is `import * as React`, a default import, or the global namespace, so `React.ButtonHTMLAttributes` no longer turns `unknown-prop` off as a passthrough type.
- **Unions, polymorphic and other components' props.** A union of props shapes contributes every member's props, and a key in several members merges its values (`{ type: "input" } | { type: "custom" }`). `ComponentProps<typeof motion.div>` and a polymorphic `ComponentPropsWithoutRef<T>` are passthrough instead of a guessed `div`. A component typed `import("react").ForwardRefExoticComponent<…>` is recognised. Boolean cva variants are boolean props.
- **A copy of a workspace package is named.** When `node_modules/<pkg>` is a separate copy of a package whose source is in the same workspace, `init --from package` warns that props added since read as unknown.
