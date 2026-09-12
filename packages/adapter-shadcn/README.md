# @zengin/adapter-shadcn

Turns a shadcn/ui project into a Zengin consumer with one command. It reads what the project already has and writes the two definition files the engine needs, plus a config.

```bash
zengin init --from shadcn          # in the project root
zengin check
```

## What it reads

| Input | Where | Becomes |
| --- | --- | --- |
| Theme variables | the CSS file defining `--background` and `--foreground` (`app/globals.css`, `src/app/globals.css`, `styles/globals.css`, or found by scanning) | `zengin/tokens.json`: semantic color tokens, `primary` + `primary-foreground` grouped, HSL triples and oklch converted to hex. The `.dark` block becomes `zengin/tokens.dark.json`. `--radius` becomes the radius scale shadcn derives from it. |
| Tailwind config | `tailwind.config.{js,ts}` on Tailwind 3, the `@theme` block on Tailwind 4 | Font families, and which namespaces extend the defaults rather than replace them. Extended namespaces are marked `extendsDefault`, so `rounded-2xl` and `font-mono` stay on-system. Spacing is never declared: shadcn projects use Tailwind's scale as their own. |
| `components/ui/*.tsx` | located through `components.json` aliases and `tsconfig` paths, or the usual places | `zengin/components.json`: one entry per file. Variants and defaults from the `cva()` or `tv()` call named for the component, props from the component's own signature (string-literal unions become enums), behavior props from the Radix package the file imports (`@radix-ui/react-*` or the unified `radix-ui`) or from cmdk, vaul and sonner, `replaces` from the file name and that package, `extends` from `React.ComponentProps<"div">`, `owns` from the utilities the cva base and variants set. |

The config it writes declares `components/ui/**` as owned, the theme directory as foundation, the ui alias as the system source, and the Tailwind adapter on. `classname-policy` starts at `warn`, because shadcn projects use `className` freely and a team should tighten it per component rather than be flooded on day one.

Nothing is executed. The theme CSS, the config and the components are read as text, so a config that imports anything is safe to point at.

## What to review

The report lists two kinds of defaults, per component:

- **`className.allow`**: overlays and menus get an empty list, inline controls get placement only, everything else gets layout. Edit per component.
- **`owns`**: derived from the classes in the `cva()` call. A property the base sets is the component's; one only a variant sets belongs to that variant prop. It is a heuristic and it is what the substitution rule uses to recognize a raw element styled like the component.

## Verified against

Two field tests. shadcn/taxonomy (Tailwind 3): hand-authored definitions gave 35 violations, none false, and the adapter reproduces the same 35 from 36 derived components. vercel/ai-chatbot (Tailwind 4, current conventions): no hand-authored definitions, 109 violations after fixes, none false, and a real migration bug found. See `docs/field-tests/`.

## Programmatic use

```ts
import { deriveShadcn, writeShadcn, renderReport } from "@zengin/adapter-shadcn";

const d = deriveShadcn("/path/to/project");
writeShadcn("/path/to/project", d, /* force */ false);
console.log(renderReport(d));
```

## Limits

- Components whose variants are not in a `cva()` or `tv()` call get behavior props only. That is accurate for most of shadcn, where a wrapper around a Radix primitive has no variants.
- Sub-parts (`DialogContent`, `CardHeader`) are recorded as slots and are not contracted yet, matching the engine.
- Tailwind 3 configs are read textually. A config that builds its `theme` dynamically will yield fewer font entries and no extend detection; the tokens still derive from the CSS.
