# @zengin/ui

The reference design system the Zengin engine is proven against. Plain CSS with custom-property tokens, Radix primitives for behavior, no styling framework. It ships its own definitions, so a project that installs it is enforceable with no extra configuration.

```bash
pnpm add @zengin/ui react react-dom
```

```tsx
import "@zengin/ui/styles.css";
import { Button, Dialog, TextField } from "@zengin/ui";
```

## What ships

| Path | Contents |
| --- | --- |
| `dist/index.js` | The components, ESM, typed. |
| `dist/zengin.css` | Tokens for both themes, the foundation, and every component stylesheet, in one file. |
| `zengin/tokens.json` | The default theme in W3C DTCG format. |
| `zengin/tokens.dark.json` | The dark theme's color overrides. |
| `zengin/components.json` | The component manifest: props, values, what `className` may set, what each component owns. The engine reads this. |

## Tokens

Everything a component paints, spaces, shapes, or moves with is a token. Semantic names only: `color.primary`, `color.surface-raised`, `color.text-muted`, never `blue-500`. Tokens compile to CSS custom properties with the names the engine checks for: `--color-primary`, `--spacing-3`, `--radius-md`, `--shadow-lg`, `--text-sm`, `--font-weight-medium`, `--duration-fast`, `--ease-standard`.

Themes attach to any element. `<html data-theme="dark">` switches the page; `<section data-theme="light">` switches a subtree back. With no attribute, the system preference decides.

| Group | Tokens |
| --- | --- |
| color | surface, surface-raised, surface-sunken, surface-overlay, text, text-muted, text-subtle, border, border-strong, focus, and for each of primary, danger, neutral: base, hover, active, soft, soft-hover, soft-foreground, on-*. success and warning: base, soft, soft-foreground, on-*. `soft-foreground` is the text on the soft tint, chosen for contrast rather than hue; a test holds every component pairing at WCAG AA in both themes. |
| space | 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16 (4px steps) |
| radius | none, sm, md, lg, xl, full |
| shadow | sm, md, lg |
| text | xs, sm, base, lg, xl, 2xl, 3xl |
| font, weight, leading | sans, mono; regular, medium, semibold; tight, normal |
| duration, ease | fast, normal, slow; standard, emphasized, exit |

## Components

Every component renders its variant props as `data-*` attributes and the stylesheet keys on those, so the contract in `components.json` and the CSS cannot drift apart without a test noticing.

| Component | Props | States |
| --- | --- | --- |
| `Button` | `variant` solid, soft, ghost, link. `tone` neutral, primary, danger. `size` sm, md, lg. `align` center, start. `loading`, `leadingIcon`, `trailingIcon`, `asChild`. | hover, active, focus-visible, disabled, loading (spinner, width preserved) |
| `Badge` | `tone` neutral, primary, danger, success, warning. `variant` soft, solid, outline. `size` sm, md. | |
| `Card` | `variant` outlined, elevated, sunken. `padding` none, sm, md, lg. `interactive`. Parts `Card.Header`, `Card.Body`, `Card.Footer`. | hover and focus-visible when interactive |
| `TextField` | `label`, `description`, `error`, `size` sm, md, lg, `leadingIcon`, `trailingIcon`, plus every `<input>` prop. | hover, focus-visible, disabled, readonly, invalid |
| `Checkbox` | `label`, `description`, `size` sm, md, plus Radix checkbox props: `checked` (including `"indeterminate"`), `onCheckedChange`, `disabled`. | unchecked, checked, indeterminate, hover, focus-visible, disabled |
| `Dialog` | `open`, `defaultOpen`, `onOpenChange`, `size` sm, md, lg, `modal`. Parts `Dialog.Trigger`, `Dialog.Content` (wraps portal and overlay), `Dialog.Title`, `Dialog.Description`, `Dialog.Footer`, `Dialog.Close`. | closed, open, with enter and exit motion |
| `Tooltip` | `content`, `side`, `delay`, `open`, `onOpenChange`. Wrap the app in `Tooltip.Provider`. | closed, open |
| `Tabs` | `variant` line, pill. `size` sm, md. `value`, `defaultValue`, `onValueChange`. Parts `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`. Arrow keys move between tabs. | active, inactive, hover, focus-visible, disabled |
| `Select` | `label`, `description`, `error`, `placeholder`, `size` sm, md, lg, plus Radix select props. Parts `Select.Item`, `Select.Group`, `Select.Label`, `Select.Separator`. | closed, open, hover, focus-visible, disabled, invalid |
| `Switch` | `label`, `description`, `size` sm, md, plus Radix switch props. | unchecked, checked, hover, focus-visible, disabled |
| `Toast` | `Toast.Provider` with `position` (four corners) and `duration`; `toast({ title, description, tone, duration, action })` from anywhere; `toast.dismiss(id?)`. | open, closed, swiping |
| `Menu` | `open`, `defaultOpen`, `onOpenChange`, `modal`. Parts `Trigger`, `Content`, `Item` (`tone`, `leadingIcon`, `shortcut`), `CheckboxItem`, `RadioGroup`, `RadioItem`, `Label`, `Separator`, `Group`. | closed, open, highlighted, disabled |
| `Table` | `density` sm, md. `stickyHeader`. `className` and `style` place the scroll container. Parts `Head`, `Body`, `Foot`, `Row` (`selected`, `interactive`), `Cell` and `HeadCell` (`align`, `numeric`). | default, selected, hover |
| `Avatar` | `src`, `name` (alt text and initials), `size` sm, md, lg, xl, `shape` circle, square, `delay`. | loading, loaded, fallback |
| `Skeleton` | `variant` text, rect, circle. `width`, `height`, `lines`. Hidden from assistive tech. | |
| `Sheet` | `open`, `defaultOpen`, `onOpenChange`, `side` right, left, top, bottom, `size` sm, md, lg, `modal`. Same parts as Dialog. | closed, open, with slide motion |
| `Popover` | `open`, `defaultOpen`, `onOpenChange`, `size` sm, md, lg, `modal`. Parts `Trigger`, `Anchor`, `Content` (`showArrow`), `Close`. | closed, open |
| `Progress` | `value`, `max`, `label`, `showValue`, `size` sm, md, `tone` primary, neutral, success, warning, danger. Indeterminate without a value. | determinate, indeterminate |
| `Separator` | `orientation` horizontal, vertical. `label`. `decorative`. | |
| `TextArea` | `label`, `description`, `error`, `size` sm, md, lg, `resize` none, vertical, both, `rows`, plus every `<textarea>` prop. | hover, focus-visible, disabled, readonly, invalid |
| `LineChart` | `series` (name, values, tone), `labels`, `height`, `area`, `curve` linear, smooth, `showGrid`, `showAxis`, `formatValue`, `aria-label`. Hover shows every series at the nearest point. | default, hover |
| `BarChart` | `series`, `labels`, `height`, `showGrid`, `showAxis`, `formatValue`, `aria-label`. Several series draw grouped bars. | default, hover |
| `Sparkline` | `values`, `tone`, `height`, `area`, `aria-label`. Sets `data-trend` up, down or flat. | |

### The customization contract, as the components implement it

- **Brand**: edit `zengin/tokens.json`, rebuild. Nothing in a component changes.
- **Appearance**: the props above. Each one maps to a `data-*` attribute with a stylesheet rule per value.
- **Composition**: `className` passes through for placement in the parent. The engine's `classname-policy` rule enforces that it stays placement: margin, width, flex and grid item, position.
- **Ownership**: copy a component's `.tsx` and `.css` into your project and declare the path under `scope.ownership`.

### Motion

Durations and easings are tokens. Buttons and cards transition on `--duration-fast`; dialogs enter on `--duration-slow` with `--ease-emphasized` and leave faster on `--ease-exit`; checkboxes draw their check. Every animated component has a `prefers-reduced-motion` rule: transitions collapse to zero, dialogs fade without moving, and the button spinner slows rather than stopping, because it is the only signal that something is happening.

## Zengin on itself

The package carries a `zengin.config.yaml` and a test that runs the engine over its own source. Components are owned files, so the contract rules are off; the foundation rules stay on. The test passes only when every color and spacing value in every component stylesheet is a token reference. It caught a hardcoded `margin-top: 0.125rem` in the checkbox on the first run.

## Charts, motion and breakpoints

The charts are SVG drawn at the container's real width, with colors from the tone tokens and no charting library; `src/styles/chart.css` is their shared foundation. `src/styles/motion.css` holds the enter presets: `z-enter-fade`, `z-enter-rise`, `z-enter-scale`, and `z-stagger` for children arriving in order, all on the duration and easing tokens and all collapsing to a fade under reduced motion. `breakpoint.sm` to `breakpoint.xl` in `tokens.json` are the widths layouts change at; media queries cannot read custom properties, so they document the values to write.

## Storybook

```bash
pnpm storybook          # http://localhost:6006
pnpm build-storybook    # static build, also run in CI
```

One story file per component under `stories/`. Controls, the variant matrices and the story-coverage test all read `zengin/components.json`, the same manifest the engine enforces against, so a manifest that disagrees with a component shows up in a story before it shows up as a wrong violation. The toolbar switches `data-theme`, exactly as a consumer would. The accessibility addon runs on every story; it found the soft-variant contrast defect that the contrast test now guards.

## Development

```bash
pnpm build      # tsc, then tokens.json -> tokens.css, then the CSS bundle
pnpm test       # rendering, manifest-against-implementation, contrast in both themes, and the engine on itself
```

`demo/index.html` shows every component and state in both themes from static markup. Serve the package directory and open it; the repo's `.claude/launch.json` has a configuration for that.

## Not yet

Select, Switch, Tabs, Toast, Menu. A second brand theme beyond dark. The marketing page and application workflow that will decide which of those come first.
