/**
 * Zengin's own documentation. Prose, not mock rows: this is the one docs site in the repository whose
 * content is real, which is why it does not use the docs template's `zengin mock` seam. Everything here is
 * checked against the CLI it describes; when a command changes, this file changes with it.
 */

export interface Doc {
  slug: string;
  section: string;
  title: string;
  summary: string;
  body: string;
  isNew?: boolean;
}

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

export const SECTIONS = ["Getting started", "The engine", "Where it runs", "Making it yours", "Reference"] as const;

export const DOCS: Doc[] = [
  // ---------------------------------------------------------------- Getting started
  {
    slug: "what-zengin-is",
    section: "Getting started",
    title: "What Zengin is",
    summary: "A design system you own, and an engine that keeps it yours.",
    body: `# What Zengin is

A design system is a set of rules nobody can enforce at the moment the code is written. Tokens live in a Figma file, component contracts live in a Storybook, and both are advisory. Code that ignores them is caught in review, days later, by a person reading a diff.

Coding agents made that worse twice over. They write far more code per hour than a review queue can absorb, and they are good at producing something that looks right: the correct color as a hex literal, the correct padding as an inline style, a raw \`div\` styled to pass for the system's own component. A screenshot review passes it. The system has quietly stopped existing in that file.

Zengin is two things that answer this together.

## Generate and own

\`zengin create\` gives you a project whose components are copied in as source, the way shadcn/ui made popular. You own every file and can change any of them. What Zengin adds is that each copied file records where it came from, so the system can tell later what you edited and what it changed underneath you.

## An engine that holds the line

The engine reads two files your project owns, \`tokens.json\` and \`components.json\`, and checks every edit against them. It is deterministic: rules against declarations, no model in the loop, the same answer in your editor that you get in CI. It runs inside an agent's tool loop, in an editor hook, in the terminal and on pull requests.

Everyone else serves context. Context is a request. Zengin serves constraints.

## What this is not

It is not a linter for code style, not a visual regression tool, and not a replacement for design review. It answers one question, exactly: does this code use the system it claims to use.

## Next

[Installation](#installation) if you are starting a project. [An existing project](#existing-project) if you already have a system and are not going to start over.`,
  },
  {
    slug: "installation",
    section: "Getting started",
    title: "Installation",
    summary: "One command, then the project owns its components.",
    body: `# Installation

\`\`\`bash
npm create zengin@latest acme -- --template saas
cd acme && npm install && npm run dev
\`\`\`

Node 20 or newer, React 18 or 19. Vite is the default; pass \`--framework next\` for the App Router.

## What you get

| Path | What it is |
| --- | --- |
| \`src/components/ui\` | The components, yours to edit. Each file records the version it was copied from. |
| \`zengin/\` | The definitions: \`tokens.json\` and \`components.json\`. The engine reads these. |
| \`src/theme/brand.css\` | The brand, as token overrides. The only file where a literal is allowed. |
| \`zengin.config.yaml\` | How strictly the definitions apply. |
| \`.mcp.json\` | The MCP server, so an agent can check its own work. |
| \`stories/\` | Storybook, with a theme toolbar. |

The generator runs the engine on the result before it returns. A fresh project reports zero violations.

## The templates

\`--template\` takes one of: \`blank\`, \`marketing\`, \`review\`, \`saas\`, \`chat\`, \`auth\`, \`docs\`, \`storefront\`. Each arrives on seeded mock data, so the screens have something in them on the first run.

\`\`\`bash
npm create zengin@latest acme -- --template docs --theme brutal
\`\`\`

## Inside the project

The CLI is a dev dependency, so every command is \`npx zengin <command>\`.

\`\`\`bash
npx zengin check                 # what is off the system
npx zengin add dialog tooltip    # more components
npx zengin theme meadow          # a different look, one file
\`\`\`

## Next

[Your first check](#first-check).`,
  },
  {
    slug: "first-check",
    section: "Getting started",
    title: "Your first check",
    summary: "Read a violation, and read the fix that comes with it.",
    body: `# Your first check

\`\`\`bash
npx zengin check
\`\`\`

A fresh project reports zero. To see the engine work, put something off the system into a file:

\`\`\`tsx
export function Actions() {
  return (
    <div style={{ display: "flex", gap: "14px" }}>
      <button style={{ background: "#2563EB", color: "#FFFFFF", padding: "8px 14px" }}>Save</button>
    </div>
  );
}
\`\`\`

## What comes back

\`\`\`
src/Actions.tsx
  3:41  error  spacing-literal  Arbitrary spacing value in inline style (gap).
                14px is not on the spacing scale.
         fix (nearest)  "var(--spacing-3)"
  4:20  error  color-literal    Color literal in inline style (background).
                The value matches color.primary in the default theme but will not
                follow theme changes.
         fix (exact)  "var(--color-primary)"
  4:7   error  component-substitution  Raw <button> styled as a system Button
                (background-color, color, padding). Use Button from @/components/ui.
\`\`\`

Three different rules, three different reasons.

## How to read one

Every violation carries four things: what rule it broke, what was found, why it is wrong in this system, and a fix with a confidence.

- **exact** means the engine knows the right answer. The literal equals a token's value.
- **nearest** means it found the closest thing on the scale and you should look. \`14px\` is not on the scale; \`var(--spacing-3)\` is 12px.
- **none** means the engine knows the code is wrong and cannot say what is right. The substitution rule usually lands here: replacing a hand-styled button with the real one is your call, not a mechanical edit.

That last distinction matters more than it looks. A tool that always proposes an edit teaches you to accept edits. The confidence is the engine telling you when to think.

## Narrowing it

\`\`\`bash
npx zengin check src/Actions.tsx     # one file or directory
npx zengin check --changed            # what git says changed
npx zengin check --staged             # what is about to be committed
\`\`\`

## Next

[The seven rules](#rules), or [Scope and ownership](#scope) for why some files are judged differently.`,
  },
  {
    slug: "existing-project",
    section: "Getting started",
    title: "An existing project",
    summary: "Derive the definitions from the system you already have.",
    body: `# An existing project

You do not have to start over, and you should not. \`zengin init\` reads the system a project already uses and writes the definitions from it.

## From a shadcn/ui project

\`\`\`bash
npx zengin init --from shadcn
\`\`\`

It reads the theme variables in your global stylesheet, the radius and font overrides in the Tailwind config, and the variant functions in \`components/ui\`, and writes \`zengin/tokens.json\`, \`zengin/components.json\` and a config. It declares \`components/ui/**\` owned and the theme directory as foundation, and starts \`classname-policy\` at \`warn\`, because shadcn projects use \`className\` freely and a team should tighten that per component rather than be flooded on day one.

## From any installed design system

\`\`\`bash
npx zengin init --from package @your/design-system
\`\`\`

Tokens come from the package's stylesheet, with the variable names kept exactly as they are, so a fix reads \`var(--surface-base)\` and not some renamed equivalent. The component manifest comes from the package's type declarations: props, enum values, and the element whose attributes pass through. Types it cannot open, from another library, are recorded as passthrough rather than guessed at.

## What to expect on the first run

A real codebase reports hundreds of violations on day one and that is the normal result, not a failure. The three field tests in the repository each did. Work in this order:

1. Set \`scope.foundations\` to the stylesheets that legitimately hold literals: your theme layer. Literals live there and nowhere else.
2. Set \`scope.ownership\` to the directories you have taken ownership of. Contract and substitution rules switch off there.
3. Turn the noisiest rule down to \`warn\` while you clear the rest, then bring it back to \`error\`.

## Components you wrote yourself

A project with its own components should also run [\`zengin define\`](#define), which reads them and writes their contracts into the manifest. Without it, the rest of your project is not held to your own components.

## Next

[Scope and ownership](#scope).`,
  },

  // ---------------------------------------------------------------- The engine
  {
    slug: "how-it-works",
    section: "The engine",
    title: "How it works",
    summary: "Definitions in, violations with fixes out. No model in the loop.",
    body: `# How it works

The engine takes two inputs and produces one output.

## The definitions

\`zengin/tokens.json\` is the W3C design-token format: names, values, types. \`zengin/components.json\` is a manifest, one entry per component, recording what it accepts and what it controls.

\`\`\`json
{
  "name": "Button",
  "export": { "from": "@/components/ui", "name": "Button" },
  "extends": "button",
  "replaces": ["button", "@headlessui/react#Button"],
  "props": {
    "variant": { "type": "enum", "values": ["solid", "soft", "ghost", "link"], "default": "solid" },
    "tone": { "type": "enum", "values": ["neutral", "primary", "danger"] }
  },
  "className": { "allow": ["margin", "width", "position"] },
  "owns": { "background-color": "tone", "padding": "size", "border-radius": null }
}
\`\`\`

\`owns\` is the interesting field. It says which CSS properties the component controls, and which prop controls each. That is what lets the engine reject \`className\` that fights the component instead of placing it.

## The pass

The engine parses your TSX and CSS, resolves class names through your own stylesheets (and Tailwind, if you use it), and checks every declaration it finds against those two files. It is a compiler pass, not a search: it knows that \`gap-3\` resolves to \`gap: 0.75rem\`, and judges the declaration rather than the string.

## Determinism, and why it is the point

The same input always produces the same violations. That is what makes the rest possible:

- An agent can call it mid-generation and fix its own output before a file is ever written.
- A hook can block a write with the violations as the reason.
- CI gives the same answer your editor gave, so nobody argues with the build.
- The counts can be tracked over time, because a change in the number means a change in the code.

A model reviewing your code would be slower, unreproducible, and wrong in ways nobody could classify. Speed matters here too: a hundred files in well under a second is what makes it usable on every keystroke.

## Next

[The seven rules](#rules).`,
  },
  {
    slug: "rules",
    section: "The engine",
    title: "The seven rules",
    summary: "Three families: the tokens, the contracts, and the system rebuilt by hand.",
    body: `# The seven rules

Seven rule kinds in three families. Each one answers a different way of leaving the system.

## Foundation: the tokens

**\`color-literal\`** finds a color literal where a token reference is required, in a class, an inline style or CSS. Hex, \`rgb()\`, \`oklch()\` and named colors all count. A literal that happens to equal a token's value is still a violation, because it will not follow a theme change. That is the whole point of the rule, and it is the one people argue with until the first rebrand.

**\`spacing-literal\`** finds an arbitrary length on margin, padding, gap or scroll offsets that is not on the spacing scale. Position offsets are coordinates, not spacing, and are left alone.

**\`token-reference\`** finds a utility class or \`var()\` reference to a token that does not exist, in a namespace your system defines tokens for. This catches the typo and the token that was renamed underneath a file.

## Contract: the components

**\`unknown-prop\`** finds a prop a system component does not declare. DOM attributes, \`aria-\`, \`data-\` and \`on*\` handlers pass through, because a component that extends an element accepts them.

**\`unknown-prop-value\`** finds an enum value the component does not accept, including one that exists in a newer version of the system than your project pins. A compound value like \`variant="ghost-danger"\` is decomposed into the props that actually express it.

**\`classname-policy\`** finds \`className\` or \`style\` on a system component setting a property the component owns. \`className\` is a placement API, for margin, width, flex and grid participation, position and display. It is not a styling API. Which properties count is per component, from the manifest's \`owns\`.

## Substitution: the system rebuilt by hand

**\`component-substitution\`** is the rule the others exist to support. It fires on an import from a package your system shadows, on a raw element styled with two or more properties a system component owns, and on a raw element styled with your system's own variant function.

This is the one that catches the expensive case: not someone using the system wrong, but someone not using it at all while producing something that looks identical. It is also the rule nobody can write by hand in a conventional linter, because it needs the manifest to know what a Button owns before it can recognise a \`div\` pretending to be one.

## Turning them up and down

\`\`\`yaml
rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  classname-policy: warn
  component-substitution:
    severity: error
    map: { "@headlessui/react#Dialog": Dialog }
\`\`\`

\`allow: semantic\` accepts palette utilities that name a semantic token and rejects raw ones. \`map\` teaches the substitution rule about an import your manifest does not already shadow. Any rule can be \`off\`, which is honest and visible, unlike a suppression scattered through the code.

## Next

[Scope and ownership](#scope).`,
  },
  {
    slug: "scope",
    section: "The engine",
    title: "Scope and ownership",
    summary: "Four kinds of file, judged differently, on purpose.",
    body: `# Scope and ownership

Not every file should be judged the same way. The engine sorts each one into four kinds.

\`\`\`yaml
scope:
  include: ["src/**/*.{ts,tsx,css}"]
  exclude: ["**/*.stories.tsx", "**/*.test.tsx"]
  foundations: ["src/theme/**"]
  ownership: ["src/components/ui/**"]
\`\`\`

## Consumer

Everything in scope that is not foundation or owned. All seven rules apply. This is most of your application.

## Foundation

Your theme layer: the files that define the tokens. Literals live here and nowhere else, so foundation rules do not run. This is not an escape hatch, it is where the values are supposed to be.

## Owned

A component you have taken ownership of. Contract and substitution rules switch off, because a forked component is yours to style and the manifest is no longer the authority on it.

Foundation rules stay on. Owning a component does not license a hardcoded color inside it, and this is deliberate: the tokens are the system's floor, and a component that hardcodes a hex will not follow a theme change no matter who owns it.

A file is owned if it matches an \`ownership\` path, or if it carries the pragma the generator writes:

\`\`\`ts
/* zengin-owned Button, forked from @zenginui/ui@0.2.0, sha 6669982b4711 */
\`\`\`

That pragma is what [\`zengin upgrade\`](#upgrade) reads later to tell your edit from the system's.

## Excluded

Stories and tests by default. They demonstrate misuse on purpose.

## The trap worth naming

Ownership silences the contract rules for the file itself, which is correct, and it used to leave the rest of your project unable to be held to that component. That is what [\`zengin define\`](#define) fixes: it reads the components you own and writes their contracts into the manifest, so a misspelled prop on your own component is caught like any other.

## Next

[Suppressions](#suppressions).`,
  },
  {
    slug: "suppressions",
    section: "The engine",
    title: "Suppressions",
    summary: "One line, one violation, and always a reason.",
    body: `# Suppressions

Sometimes the code is right and the rule does not know it. Say so on the line above:

\`\`\`tsx
// zengin-allow color-literal: hero gradient, approved in brand review
<div style={{ background: "linear-gradient(#FF5F3D, #D7472F)" }} />
\`\`\`

## The rules about the rule

One comment suppresses one violation on the next line. It names the rule. And it carries a reason after the colon.

**A comment with no reason suppresses nothing.** The violation still reports, and the engine tells you the comment was ignored. This is the single most opinionated decision in the tool and it is deliberate: a suppression without a reason is indistinguishable from giving up, and a codebase full of them is a system nobody believes in.

## They are counted

Every suppression appears in the inventory, and the rollup tracks the total over time. A number that climbs steadily says the rules are wrong for this codebase, which is useful information about the rules rather than about the developers.

Suppressions without reasons are counted separately, which is how a team finds the ones that were never really decisions.

## When to turn a rule off instead

If you are writing the same suppression in twenty files, turn the rule down in the config or scope it to a path:

\`\`\`yaml
rules:
  color-literal: { severity: error, except: ["src/illustrations/**"] }
\`\`\`

One visible decision in one file beats twenty invisible ones scattered through the code.

## Next

[The MCP server](#mcp).`,
  },

  // ---------------------------------------------------------------- Where it runs
  {
    slug: "mcp",
    section: "Where it runs",
    title: "The MCP server",
    summary: "Four tools an agent calls before it commits to an answer.",
    body: `# The MCP server

The engine's most useful position is inside the agent's loop, before a file exists.

\`\`\`json
{
  "mcpServers": {
    "zengin": {
      "command": "zengin-mcp",
      "env": { "ZENGIN_CONFIG": "zengin.config.yaml" }
    }
  }
}
\`\`\`

\`zengin create\` writes this file for you.

## The tools

**\`zengin_describe_system\`** returns the tokens and the component contracts. An agent calls it before it plans, so it writes against the real system instead of a guess.

**\`zengin_check_code\`** takes a snippet and returns violations with fixes, without touching disk. This is the one that changes behaviour: the agent checks what it is about to write, and corrects itself.

**\`zengin_get_violations\`** checks the files in scope, or only the ones that changed.

**\`zengin_explain_rules\`** returns what each rule means and how to suppress one, in the same words every other surface uses.

## Why this beats a context file

A rules document in the prompt is a request the model may or may not honour, and it competes with everything else for attention. A tool call returns a fact. The agent does not have to remember the spacing scale; it has to call a function that knows it.

## Next

[The editor hook](#hook).`,
  },
  {
    slug: "hook",
    section: "Where it runs",
    title: "The editor hook",
    summary: "Every write checked, and blocked with the reason.",
    body: `# The editor hook

The MCP server relies on the agent choosing to call it. The hook does not.

\`zengin create\` registers a Claude Code \`PostToolUse\` hook that runs after every file write. If the write introduced violations, the hook blocks it and returns them as the reason, which the agent then reads and fixes.

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "zengin-hook" }] }
    ]
  }
}
\`\`\`

## What it feels like

The agent writes a component with a hardcoded color. The write is refused with the violation and the fix. The agent rewrites it using the token. You never see the first version.

This is the difference between a tool that reports and a tool that holds a line. Reporting happens after the fact and competes for someone's attention. Blocking happens at the moment the mistake is made, when it is cheapest to fix and nobody has built on top of it yet.

## Next

[The CLI and CI](#cli-ci).`,
  },
  {
    slug: "cli-ci",
    section: "Where it runs",
    title: "The CLI and CI",
    summary: "The same answer in the terminal and on the pull request.",
    body: `# The CLI and CI

\`\`\`bash
npx zengin check                    # everything in scope
npx zengin check --changed          # what git says changed
npx zengin check --staged           # pre-commit
npx zengin check --format github    # annotations on the pull request
npx zengin check --format json      # for anything else
\`\`\`

## Pre-commit

\`\`\`bash
npx zengin check --staged --fail-on error
\`\`\`

Exit code 1 when anything at or above the threshold is found, so any hook runner will do.

## On a pull request

\`\`\`yaml
- run: npx zengin check --changed --format github
\`\`\`

The \`github\` format writes annotations, so a violation appears on the line in the diff rather than in a log nobody opens.

## Why --changed matters on adoption

A codebase adopting Zengin starts with a real backlog. Checking only what changed means the number that gates the build is the number the author is responsible for, and the backlog comes down on its own as files get touched. Gating the whole repository on day one gets the tool turned off in a week.

## Next

[The rollup](#rollup).`,
  },
  {
    slug: "rollup",
    section: "Where it runs",
    title: "The rollup",
    summary: "Whether the system is winning, across every repository that uses it.",
    body: `# The rollup

One repository's check answers whether that code is on the system. A design-system team needs the other question: is the system being adopted, everywhere, over time.

\`\`\`bash
# in each consuming repository, on every push to main
npx zengin report --into ../reports

# wherever the reports collect
npx zengin rollup ../reports --format html --out public/rollup/index.html
\`\`\`

## What a snapshot records

More than violations. Each report carries an inventory: which components are used and how often, which files are owned and what version they were forked from, how many suppressions there are and how many of those have no reason, and which components are used without a contract.

## What the rollup shows

Drift and adoption per repository, the deltas between runs, and the trend over time as a chart and a sparkline per repo. The directory of snapshots is the history, so nothing needs a database.

Zengin hosts its own at [zengin.timurtek.com/rollup](https://zengin.timurtek.com/rollup/), built from the example apps in the repository on every push.

## The number that matters

Not the violation count. The ratio of owned components that have drifted from their upstream version, and the suppression count without reasons. Those two say whether the system is a living thing or a folder people copy from.

## Next

[Themes and brand](#themes).`,
  },

  // ---------------------------------------------------------------- Making it yours
  {
    slug: "themes",
    section: "Making it yours",
    title: "Themes and brand",
    summary: "The whole look is one file of token overrides.",
    body: `# Themes and brand

\`\`\`bash
npx zengin theme            # what is available
npx zengin theme brutal     # swap the look
\`\`\`

Six themes ship: \`default\`, \`zengin\`, \`meadow\`, \`plex\`, \`spec-sheet\`, \`brutal\`. A theme is a file of token overrides and nothing else. No component CSS changes, because components never name a color.

## A brand from one color

\`\`\`bash
npx zengin brand --name Acme --primary "#D7472F"
npx zengin brand --name Acme --logo logo.svg
\`\`\`

It derives a full palette, checks every foreground and background pair against WCAG AA and adjusts until they pass, and writes the favicon and a wordmark. From an SVG logo it takes the primary color out of the file.

\`--radius sharp|soft|round\` sets the corner scale in the same pass.

## Why this works

Every component reads \`var(--color-primary)\`, never \`#D7472F\`. That indirection is what the \`color-literal\` rule exists to protect, and this is the payoff: the brand is one file, and changing it changes everything at once, with the engine telling you about any file that will not follow.

That last part is the one people underestimate. Without an engine, a rebrand is "change the tokens and hope". With one, a rebrand is "change the tokens, then read the list of every place that hardcoded the old value".

## Next

[Fonts and icons](#fonts-icons).`,
  },
  {
    slug: "fonts-icons",
    section: "Making it yours",
    title: "Fonts and icons",
    summary: "A typeface pairing and an icon set, each by name.",
    body: `# Fonts and icons

## Fonts

\`\`\`bash
npx zengin fonts                    # the pairings
npx zengin fonts fraunces           # set display, text and code faces
npx zengin fonts fraunces --self-host
\`\`\`

Ten curated pairings. Each sets three tokens, for headlines, body text and code, at the weights the components actually use, and rewrites the stylesheet link. \`--self-host\` downloads the woff2 files into \`public/fonts\` and writes the \`@font-face\` rules, so Google is not in your runtime.

## Icons

\`\`\`bash
npx zengin icons                    # the sets
npx zengin icons tabler
\`\`\`

Zengin UI exports \`Icon\`, a vocabulary of 63 named glyphs, and the components draw their own chevrons, checks and close buttons from it. \`zengin icons\` rewrites \`src/lib/icons.tsx\` so the same names are drawn by a different set: \`lucide\`, \`tabler\`, \`phosphor\`, \`heroicons\`, \`feather\`, \`radix\`, \`material\` or \`bootstrap\`.

**The names in your code never change.** \`<Icon.Search />\` is \`<Icon.Search />\` whichever set draws it. Every mapping is checked against the set's real exports when the registry is built, so a name that does not exist in a set is caught before you install it, not at runtime.

## Next

[Components you add](#add).`,
  },
  {
    slug: "add",
    section: "Making it yours",
    title: "Components you add",
    summary: "More from the registry, into your project as source.",
    body: `# Components you add

\`\`\`bash
npx zengin add dialog tooltip table
\`\`\`

Each one arrives as source in \`src/components/ui\`, with its stylesheet imported, its story written, its manifest entry added, its dependencies installed, and a line appended to the barrel. The files carry the ownership pragma, so \`zengin upgrade\` can reason about them later.

Every item is in [the hosted Storybook](https://zengin.timurtek.com/storybook/) with its manifest-driven controls, which is the fastest way to decide what you want before you add it.

## The packages they need

Adding a component writes its files and tells you what it needs from npm. It does not install anything unless you ask:

\`\`\`bash
npx zengin add combobox --install
\`\`\`

The package manager comes from your lockfile, so the command is the one your project actually uses. Without the flag the output ends with that command and the project will not typecheck until you run it — a missing peer dependency reads like a broken component otherwise, which is exactly how it read to the first person who hit it.

## A name it does not know

One wrong name no longer costs you the batch. The names the registry knows go in, and the one it does not comes back with its nearest match and the full list:

\`\`\`
$ npx zengin add button card dialog codeblock

Added button, card, dialog from https://zengin.timurtek.com/r (Zengin UI 0.1.0).

Not added, because the registry has no such item:
  codeblock  — did you mean code-block?
\`\`\`

## A story that is held back

A component's story ships with the component, and some stories demonstrate the component inside another one — a Loader inside a Message, for instance. If your project does not have that other component, the story is withheld rather than written, and \`add\` says which one it skipped and what would bring it in. The alternative was a project that does not compile the moment it is created.

## The registry

It is static JSON. The public one is served at [zengin.timurtek.com/r](https://zengin.timurtek.com/r/index.json), rebuilt on every deploy. Point somewhere else with \`--registry\`:

\`\`\`bash
npx zengin add card --registry https://design.acme.com/r
ZENGIN_REGISTRY=./our-registry npx zengin add card
\`\`\`

A private registry of your own components is the same shape at a different URL. There is no server to run.

## What is in it

Components, templates, themes, font pairings, icon sets, and the shared library files. \`npx zengin registry build --out public/r\` builds one from a Zengin repository checkout.

## Next

[Components you write](#define).`,
  },
  {
    slug: "define",
    section: "Making it yours",
    title: "Components you write",
    summary: "A component you invented, held to the same rules as the rest.",
    isNew: true,
    body: `# Components you write

Sooner or later your design needs something the system does not have. You write it, in \`src/components/ui\`, where the contract and substitution rules are off so the file may style itself freely.

That is right for the file and wrong for everyone else. Nothing tells the rest of your project what the component accepts, so a misspelled prop or an invented variant passes. The component joined the system's surface without joining its rules.

\`\`\`bash
npx zengin define            # a report
npx zengin define --write    # apply it
\`\`\`

## What it reads

Everything comes from what the component already declares, so there is nothing new to maintain.

- **Props** from its TypeScript types, with named aliases opened, so \`tone?: ThresholdTone\` becomes the enum it is rather than an opaque value.
- **Defaults** from the destructuring in the component's own signature.
- **\`extends\`** from the element whose attributes pass through, so \`InputHTMLAttributes<HTMLInputElement>\` records that it is an input.
- **\`owns\`** from its stylesheet. A property set under \`[data-tone="..."]\` is controlled by \`tone\`; one set under a state the component sets for itself, like \`[data-disabled]\`, is controlled by nobody and recorded as \`null\`.

It also exports the component from your barrel, because a definition nobody can import changes nothing.

## The result

\`\`\`
error  unknown-prop-value  Threshold has no tone "scarcity".
                           Valid: neutral, primary, danger.
error  unknown-prop        Threshold has no prop "wobble".
                           Props: label, size, tone, showValue.
\`\`\`

Your own component, enforced like any other.

## It never removes

A prop your manifest carries that the source cannot see, from a passthrough type or a compound component, survives. A hand-declared enum beats a type the walker could not open. And where your manifest and your stylesheet disagree about which prop controls a property, the manifest wins and the disagreement is reported:

\`\`\`
The manifest and the stylesheet disagree (1). The manifest was kept:
  Button.background-color: manifest says tone, stylesheet says variant
\`\`\`

That report is worth reading rather than clearing. One side of each disagreement is wrong.

## Next

[A different design in one place](#declared-differences).`,
  },
  {
    slug: "declared-differences",
    section: "Making it yours",
    title: "A different design in one place",
    summary: "Say that part of the project is meant to look different, in the definitions.",
    isNew: true,
    body: `# A different design in one place

A marketing page and an application are not the same design. The marketing button is a pill; the application button is not. Both are correct.

Until you can say that, the only ways to express it are to run two systems or to suppress a rule on every line, and both spell a deliberate difference as drift.

\`\`\`yaml
profiles:
  - name: marketing
    include: ["src/marketing/**"]
    tokens: zengin/tokens.marketing.json
    components:
      Button:
        props:
          shape: { type: enum, values: [pill, square] }
        owns: { border-radius: shape }
\`\`\`

## How it resolves

Each file is checked against the first entry whose \`include\` matches it, and against the base system when none does. So \`shape="pill"\` is correct under \`src/marketing\` and still a violation in the application, reported against that part's own list of valid values.

The point is not to loosen the rule. It is to say which rule applies where, once, in a file everyone can read.

## What it may change

Token values, layered over the base so the file carries only what differs, and a component's \`props\`, \`owns\` and \`className\` policy, merged over the base entry by name.

## What it may not

Add or remove a component. A different set of components is a different system, not a different look, and the engine refuses the config rather than checking half of one.

## In the rollup

The inventory records which profile checked each file, so a rollup shows the split rather than averaging two designs into one misleading number.

## Next

[Upgrading](#upgrade).`,
  },
  {
    slug: "upgrade",
    section: "Making it yours",
    title: "Upgrading",
    summary: "Take what changed upstream without losing what you changed.",
    body: `# Upgrading

You own your components, which is the point, and it is also the classic problem with copying source: the upstream improves and you never get it.

\`\`\`bash
npx zengin upgrade            # a report
npx zengin upgrade --write    # apply the safe part
\`\`\`

## How it can tell

Every copied file carries a pragma with the version it came from and a hash of exactly what was copied:

\`\`\`ts
/* zengin-owned Button, forked from @zenginui/ui@0.2.0, sha 6669982b4711 */
\`\`\`

Comparing the hash of the file on disk against that record says whether you edited it. Comparing the upstream against the recorded version says whether the system changed. Those two answers give five states:

| State | What it means |
| --- | --- |
| **current** | Nothing changed on either side. |
| **upstream** | The system changed, you did not. Safe to take. |
| **local** | You changed it, the system did not. Yours; left alone. |
| **conflict** | Both changed. The report shows the diff and you decide. |
| **gone** | The component no longer exists upstream. |

\`--write\` takes the upstream ones and moves the pinned version. \`--force\` takes upstream over a conflict, discarding your edit, which is why it is a separate flag.

## What a conflict looks like

The report prints a real diff of both sides, so the decision is made with the change in front of you rather than from a filename.

## Next

[CLI reference](#cli-reference).`,
  },

  // ---------------------------------------------------------------- Reference
  {
    slug: "cli-reference",
    section: "Reference",
    title: "CLI reference",
    summary: "Every command, in one place.",
    body: `# CLI reference

Inside a project the CLI is a dev dependency, so commands are \`npx zengin <command>\`.

## Checking

| Command | What it does |
| --- | --- |
| \`zengin check [paths...]\` | Check files. Defaults to everything in scope. |
| \`zengin explain [rule]\` | What each rule checks, and how to suppress one. |
| \`zengin report [--out file]\` | One repository's snapshot, as JSON, for the rollup. |
| \`zengin report --into <dir>\` | The same, filed so the directory becomes the history. |
| \`zengin rollup <dirs...>\` | Drift, adoption and trends across repositories. |

Check options: \`--changed\`, \`--staged\`, \`--format pretty|json|github\`, \`--fail-on error|warn|info|never\`, \`--rules <ids>\`, \`--severity <level>\`.

## Starting and growing

| Command | What it does |
| --- | --- |
| \`zengin create <dir>\` | A new project: components copied in, engine, MCP, hook and Storybook wired. |
| \`zengin add <items...>\` | Components or templates from the registry. |
| \`zengin define [names...]\` | Your own components into the manifest, from their types and CSS. |
| \`zengin upgrade [items...]\` | What changed upstream since you copied. \`--write\` takes it. |
| \`zengin init\` | A config in an existing project. \`--from shadcn\`, \`--from package <name>\`. |

Create options: \`--template\`, \`--theme\`, \`--framework vite\\|next\`, \`--name\`, \`--registry\`, \`--no-storybook\`.

Add options: \`--install\` (run the package manager your lockfile names), \`--registry\`, \`--force\` (overwrite files that already exist). An unknown name does not stop the rest of the batch; it comes back with the registry's own name for it.

## Making it yours

| Command | What it does |
| --- | --- |
| \`zengin theme [name]\` | List the themes, or swap this project's. |
| \`zengin fonts [name]\` | List the pairings, or set the three font tokens. \`--self-host\`. |
| \`zengin icons [set]\` | List the sets, or redraw the icon vocabulary from one. |
| \`zengin brand --name <n>\` | A brand from a name, a logo or a color, at WCAG AA. |
| \`zengin tokens\` | Compile the token JSON to CSS custom properties. |
| \`zengin mock <presets...>\` | Typed, seeded mock data as source. \`--schema\`, \`--count\`. |
| \`zengin figma <sub>\` | \`export\`, \`import\`, \`connect\`, \`plugin\`. |
| \`zengin registry build --out <dir>\` | Build a registry from a Zengin checkout. |

## Next

[Configuration](#config-reference).`,
  },
  {
    slug: "config-reference",
    section: "Reference",
    title: "Configuration",
    summary: "Every key in zengin.config.yaml.",
    body: `# Configuration

\`zengin.config.yaml\`, at the project root. Paths resolve against the directory it sits in.

\`\`\`yaml
system:
  package: "@zenginui/ui"
  version: "0.2.0"                 # read from node_modules when omitted
  sources: ["@zenginui/ui", "@/components/ui/*"]
  definitions: ./zengin            # default: node_modules/<package>/zengin

scope:
  include: ["src/**/*.{ts,tsx,css}"]
  exclude: ["**/*.stories.tsx", "**/*.test.tsx"]
  foundations: ["src/theme/**"]
  ownership: ["src/components/ui/**"]

classes:
  tailwind: auto                   # auto | true | false
  css: ["app/globals.css"]

rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: error
  component-substitution:
    severity: error
    map: { "@headlessui/react#Dialog": Dialog }

profiles:
  - name: marketing
    include: ["src/marketing/**"]
    tokens: zengin/tokens.marketing.json
    components:
      Button:
        props:
          shape: { type: enum, values: [pill, square] }
\`\`\`

## system

\`package\` is the design system. \`sources\` are the import paths that count as the system, globs allowed, which is how an alias like \`@/components/ui\` is recognised. \`definitions\` overrides where \`tokens.json\` and \`components.json\` are read from.

## scope

See [Scope and ownership](#scope). \`foundations\` is where literals are allowed. \`ownership\` is where the contract and substitution rules switch off.

## classes

\`tailwind: auto\` enables the Tailwind adapter when your \`package.json\` depends on it. \`css\` names stylesheets whose \`@custom-variant\` and \`@utility\` rules the class compiler needs to know about, and stylesheets that ship precompiled utilities.

## rules

Each rule takes a severity, or \`off\`, or an object. Common options are \`allow: semantic|palette\` on \`color-literal\`, \`except: [globs]\` on any rule, and \`map\` on \`component-substitution\`.

## profiles

See [A different design in one place](#declared-differences). Optional, and empty by default, which is the single-design case. The key was called \`surfaces\` in 0.2.0, which collided with the four surfaces the engine reaches you through; a config that still says \`surfaces:\` is refused by name.`,
  },
];

/** The headings in a markdown body, for the on-this-page outline. */
export function headingsOf(body: string): Heading[] {
  const out: Heading[] = [];
  for (const line of body.split("\n")) {
    const m = /^(##|###)\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = m[2]!.replace(/`/g, "").trim();
    out.push({ level: m[1] === "##" ? 2 : 3, text, id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") });
  }
  return out;
}
