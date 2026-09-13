/**
 * The documentation: sections of pages, each a markdown string, paired with the metadata `zengin mock`
 * generated in src/mock from mock.json (who touched it last, when, how often it is read). The prose is
 * the product's; the rows are the part that changes. Regenerate the rows with `npm run mock`.
 */

import { pages } from "./mock/pages";

export interface Doc {
  slug: string;
  section: string;
  title: string;
  summary: string;
  body: string;
  isNew?: boolean;
  /** From the mock rows. */
  author: string;
  updated: string;
  views: number;
}

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

const CATALOG: Omit<Doc, "author" | "updated" | "views">[] = [
  {
    slug: "installation",
    section: "Getting started",
    title: "Installation",
    summary: "One command, then the project owns its components.",
    body: `# Installation

Zengin creates a project with the components copied in, the engine wired, and Storybook ready.

\`\`\`bash
npx zenginui create acme --template saas
cd acme && npm install && npm run dev
\`\`\`

## What you get

| Path | What it is |
| --- | --- |
| \`src/components/ui\` | The components, yours to edit. Each file carries the version it was copied from. |
| \`zengin/\` | The definitions: tokens and the component manifest. The engine reads them. |
| \`src/theme/brand.css\` | The brand as token overrides. The only file where a literal is allowed. |
| \`zengin.config.yaml\` | How strictly the definitions apply. |

## Requirements

Node 20 or newer. React 18 or 19. Vite is the default bundler; Next works the same way with the alias in \`tsconfig.json\`.

## Next

Read [Your first project](#first-project), or run \`zengin check\` and read what it says.`,
  },
  {
    slug: "first-project",
    section: "Getting started",
    title: "Your first project",
    summary: "Add a component, break a rule on purpose, watch the fix.",
    body: `# Your first project

The fastest way to understand the engine is to break a rule.

## Add a component

\`\`\`bash
npm run add -- dialog tooltip
\`\`\`

Both land in \`src/components/ui\` with their stylesheet and their manifest entry.

## Break a rule

Put a literal color where a token belongs:

\`\`\`tsx
<Button style={{ background: "#2563EB" }}>Approve</Button>
\`\`\`

Run \`zengin check\`:

\`\`\`
src/App.tsx
  6:22  error  classname-policy  style on Button may not set background. background-color is owned by the tone prop.
         fix (exact)  tone="primary"
\`\`\`

The fix is exact because the literal equals \`color.primary\` in the default theme. Apply it, run again, nothing.

## Let the agent do it

With the hook installed, the same check runs after every edit an agent makes, and a violation with a fix goes back to it before the edit lands.`,
  },
  {
    slug: "tokens",
    section: "Getting started",
    title: "Tokens",
    summary: "Color, space, radius, type, motion. One file, both schemes.",
    body: `# Tokens

Every value a component uses is a token, declared in \`zengin/tokens.json\` in the W3C design-token format and rendered to CSS custom properties.

## Groups

| Group | Variables | Used for |
| --- | --- | --- |
| \`color\` | \`--color-primary\`, \`--color-surface\`, \`--color-text-muted\` | Every color, in both schemes |
| \`space\` | \`--spacing-1\` to \`--spacing-32\` | Padding, gaps, margins |
| \`radius\` | \`--radius-sm\` to \`--radius-full\` | Corners |
| \`text\`, \`font\`, \`weight\`, \`leading\` | \`--text-lg\`, \`--font-display\` | Type |
| \`duration\`, \`ease\` | \`--duration-fast\`, \`--ease-standard\` | Motion |

## Dark

\`zengin/tokens.dark.json\` overrides colors only. The engine checks that it defines nothing the light file does not.

## Semantic, not palette

There is no \`--color-blue-500\`. A component asks for \`--color-primary\`; the brand decides what that is.`,
  },
  {
    slug: "button",
    section: "Components",
    title: "Button",
    summary: "Four variants, three tones, three sizes, and nothing else.",
    body: `# Button

\`\`\`tsx
import { Button } from "@/components/ui";

<Button tone="primary" leadingIcon={<Icon.Plus />}>New customer</Button>
<Button variant="soft">Export</Button>
<Button variant="ghost" size="sm" aria-label="Settings" leadingIcon={<Icon.Settings />} />
\`\`\`

## Props

| Prop | Values | Default |
| --- | --- | --- |
| \`variant\` | \`solid\`, \`soft\`, \`ghost\`, \`link\` | \`solid\` |
| \`tone\` | \`neutral\`, \`primary\`, \`danger\` | \`neutral\` |
| \`size\` | \`sm\`, \`md\`, \`lg\` | \`md\` |
| \`loading\` | boolean | \`false\` |
| \`asChild\` | boolean | \`false\` |

## What it owns

Background, color, border color, padding and font are the button's. \`className\` places it (margin, width, flex and grid item, position) and does nothing else; the engine reports a class that tries.

## A link that looks like a button

\`\`\`tsx
<Button asChild variant="soft"><a href="/docs">Read the docs</a></Button>
\`\`\``,
  },
  {
    slug: "dialog",
    section: "Components",
    title: "Dialog",
    summary: "A modal with a title, a description and a footer; focus and escape handled.",
    body: `# Dialog

\`\`\`tsx
<Dialog open={open} onOpenChange={setOpen} size="sm">
  <Dialog.Content>
    <Dialog.Title>Reject ZN-2041?</Dialog.Title>
    <Dialog.Description>The author will be notified.</Dialog.Description>
    <Dialog.Footer>
      <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
      <Button tone="danger" onClick={reject}>Reject</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
\`\`\`

## Sizes

\`sm\` for a confirmation, \`md\` for a form, \`lg\` for content. The overlay, the focus trap and the escape key are Radix's.

## Replaces

\`@headlessui/react#Dialog\` and \`@radix-ui/themes#Dialog\`. An import from either is a substitution violation with the migration note.`,
  },
  {
    slug: "table",
    section: "Components",
    title: "Table",
    summary: "Rows of data with a sticky header, two densities, aligned cells.",
    body: `# Table

\`\`\`tsx
<Table density="sm" stickyHeader aria-label="Invoices">
  <Table.Head>
    <Table.Row>
      <Table.HeadCell>Invoice</Table.HeadCell>
      <Table.HeadCell align="end">Amount</Table.HeadCell>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    {rows.map((r) => (
      <Table.Row key={r.id}>
        <Table.Cell>{r.id}</Table.Cell>
        <Table.Cell align="end">{money(r.amount)}</Table.Cell>
      </Table.Row>
    ))}
  </Table.Body>
</Table>
\`\`\`

## Replaces the element

The manifest says \`Table\` replaces \`<table>\`. A raw table styled with two properties the component owns is reported; a raw table with none is left alone.`,
  },
  {
    slug: "theming",
    section: "Guides",
    title: "Theming",
    summary: "A brand is one file. Six come with the registry; yours from one color.",
    body: `# Theming

\`\`\`bash
npx zenginui theme brutal                     # swap the brand file and the fonts link
npx zenginui brand --name Acme --logo logo.svg   # a palette from the logo's color, pushed to AA
\`\`\`

## The brand file

\`src/theme/brand.css\` redefines tokens. Nothing in a component changes, because components only ever read tokens.

\`\`\`css
:root, [data-theme="light"] {
  --color-primary: #D3442C;
  --color-on-primary: #FFFFFF;
  --radius-md: 0px;
}
\`\`\`

## Contrast

\`zengin brand\` derives the palette in OKLCH and pushes each pairing until it reaches WCAG AA in both schemes. The report lists every ratio.`,
  },
  {
    slug: "icons-and-fonts",
    section: "Guides",
    title: "Icons and fonts",
    summary: "Draw by name; pick the set and the pairing for the whole project.",
    isNew: true,
    body: `# Icons and fonts

## Icons

Components and app code draw by name: \`<Icon.Search />\`, \`<Icon.Close />\`. The drawings are Zengin UI's own until you pick a set:

\`\`\`bash
npx zenginui icons tabler     # lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap
\`\`\`

\`src/lib/icons.tsx\` is rewritten so the same names come from \`react-icons/tb\`. A direct import from an icon package anywhere else is a substitution violation.

## Fonts

A pairing is three roles, headlines, text and code:

\`\`\`bash
npx zenginui fonts fraunces
npx zenginui fonts geist --self-host   # the files into public/fonts, no Google at runtime
\`\`\`

Only the three font tokens change. The palette stays.`,
  },
  {
    slug: "mock-data",
    section: "Guides",
    title: "Mock data",
    summary: "Typed, seeded rows so a screen shows something real before the backend does.",
    body: `# Mock data

\`\`\`bash
npx zenginui mock customers invoices          # presets, one module each
npx zenginui mock --schema mock.json          # your own entities
\`\`\`

\`\`\`ts
import { customers } from "@/mock/customers";
customers[0]; // { id: "CUS-1000", name: "Ada Okafor", plan: "Team", mrr: 396, ... }
\`\`\`

## Why seeded

The same seed gives the same rows on every run, so a preview, a story and a screenshot never drift. Change the seed for a different draw of the same shape.

## Prose is not data

A sentence from a word pool is not a review title. The templates keep prose in a catalog and take only what changes from the rows: who, when, status, counts.`,
  },
  {
    slug: "cli",
    section: "Reference",
    title: "CLI",
    summary: "Every command, in the order you will meet them.",
    body: `# CLI

| Command | What it does |
| --- | --- |
| \`zengin create <dir>\` | A new project from a template, components copied in |
| \`zengin add <items>\` | Components or templates from the registry into this project |
| \`zengin check\` | Violations with fixes; \`--changed\`, \`--staged\`, \`--format github\` |
| \`zengin theme\`, \`fonts\`, \`icons\` | The brand, the type, the glyphs |
| \`zengin brand --name\` | A brand from a name, a logo or a color |
| \`zengin mock\` | Seeded rows into \`src/mock\` |
| \`zengin report\`, \`rollup\` | One repository's snapshot; drift and adoption across many, over time |
| \`zengin figma export\`, \`import\` | Tokens to Figma variables and back |
| \`zengin init --from shadcn\`, \`--from package\` | Definitions for a system you already have |

## Exit codes

\`0\` clean or below \`--fail-on\`, \`1\` violations at or above it, \`2\` usage or configuration error.`,
  },
];

/** The mock's fixed "now"; the generated dates are relative to it, so the labels are too. */
const NOW = Date.UTC(2026, 8, 12);
const DAY = 86400000;
const ago = (iso: string): string => {
  const days = Math.round((NOW - new Date(`${iso}T00:00:00Z`).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
};

export const DOCS: Doc[] = CATALOG.map((d, i) => {
  const row = pages[i % pages.length]!;
  return { ...d, author: row.author, updated: ago(row.updated), views: row.views };
});

export const SECTIONS = [...new Set(DOCS.map((d) => d.section))];

export function headingsOf(body: string): Heading[] {
  const out: Heading[] = [];
  for (const line of body.split("\n")) {
    const m = /^(##|###) (.+)$/.exec(line);
    if (m) out.push({ level: m[1] === "##" ? 2 : 3, text: m[2]!, id: m[2]!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") });
  }
  return out;
}

export function compact(n: number): string {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}
