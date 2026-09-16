# @zenginui/engine

## 0.5.0

### Minor Changes

- [`4d14470`](https://github.com/Timurtek/zengin/commit/4d14470b9869a6ef64a5e352296b8fb94cc1d724) Thanks [@Timurtek](https://github.com/Timurtek)! - One definition of the agent wiring, a `--fix` that does what it prints, and a manifest that records who owns what.
  
  - **`zengin-hook settings` and the hook's README printed the configuration the rest of the toolchain warns
    about**: a bare `zengin-hook` command, which is the PATH bug the whole family is named after, and a matcher
    without `Bash`, which `doctor` flags. `AGENT_WIRING` existed so `create` and `doctor` could not drift apart,
    and the hook was a third emitter that could not import it — the constant lived in the registry, which the
    hook does not depend on. It lives in the engine now, the one package all three depend on, and the hook
    prints it rather than a literal of its own. **A constant that cannot be imported by everyone who needs it is
    not one source of truth.**
  
  - **`doctor --fix` printed `fix` lines for things it did not fix.** The matcher lives in
    `.claude/settings.json`, a file Zengin writes, so `--fix` repairs it now. And advice is labelled `by hand`
    rather than `fix`, with a closing line after a `--fix` run saying that what remains needs a person —
    rendering both the same way, under a flag named `--fix`, told the reader the matcher had been changed when
    it had not.
  
  - **The published manifest under-recorded ownership, and `define` can now say so accurately.** A stylesheet
    names a data attribute; `owns` names a prop, and the two are often different words: a field's
    `data-invalid` comes from its `error` prop, and reading the attribute as the prop name found nothing and
    recorded `null`. The deriver now follows a data attribute back through the component's own consts to the
    props that feed it (`const invalid = Boolean(error)`, `const isDisabled = disabled || loading`). Zengin UI's
    manifest is regenerated: nine properties that said `null` or too little now name the prop that governs
    them, including Button's opacity under `loading` and Select's and TextArea's border colour under `error`.

## 0.4.0

### Minor Changes

- [`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2) Thanks [@Timurtek](https://github.com/Timurtek)! - The three ship-blockers from field test four.
  
  A session built a real application on Zengin as a stranger would, from the public packages and the public
  registry, and wrote up eighteen findings. Three of them stopped a fresh clone working.
  
  **The enforcement loop did not engage for anyone but its author.** `zengin create` wrote `.mcp.json` and the
  edit hook with bare `zengin-mcp` and `zengin-hook` commands. Those live in `node_modules/.bin`, which is on
  PATH inside an npm script and nowhere else, and an agent launches them directly. So unless the packages were
  installed globally, the MCP server failed to start and the hook never fired, silently. It worked in this
  repository because its own examples point at `node ../../packages/mcp/dist/index.js`. Both are now invoked
  through `npx`, and `create` ends by saying to open a new agent session in the new directory, since MCP
  servers and hooks are read when a session starts.
  
  **Projects did not compile out of the box.** A component's story ships with the component, and nothing
  checked that the story's imports were satisfied by what the item delivers: a Loader story demonstrating a
  Loader inside a Message landed in projects with no Message, and `tsc` failed immediately after `zengin check`
  reported zero. Twelve items had this. Rather than make every story self-contained, which makes worse
  documentation, or drag Button into a dozen installs that do not need it, the registry now records what each
  story needs beyond its own item and install writes the story only where those are present, naming what was
  left out and why.
  
  **A `var()` naming a family the system does not have went unreported.** `var(--tracking-wide)` against a
  system with no tracking tokens resolves to nothing at runtime with no error anywhere, and `token-reference`
  only looked inside namespaces the system already owned. It now reports these too, which required teaching the
  engine two things first so the widening does not invent false positives: every custom property the project's
  own stylesheets declare, in any file, so a theme-defined property used in a component is recognised as the
  project's own; and the prefixes a dependency uses for properties it sets at runtime, derived from the
  project's own dependencies rather than a hard-coded list, so Radix writing `--radix-popover-content-transform-origin`
  from JavaScript is left alone. `rules.token-reference.externalVars` adds any the convention misses.
  
  Also from the same report: `create` no longer suggests adding components the chosen template already has.

- [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15) Thanks [@Timurtek](https://github.com/Timurtek)! - `owns` says who controls a property, accurately.
  
  A manifest entry's `owns` names the prop a reader should reach for when the engine rejects their `className`,
  so naming the wrong one sends them to a prop that does not do the thing. Running `zengin define` against
  Zengin UI's own components surfaced eleven places where the manifest and the stylesheets disagreed. Two were
  the manifest being wrong and the rest were the deriver being wrong, which is the more useful half.
  
  - **A property may be controlled by more than one prop, and now says so.** A Button's background takes its hue
    from `tone` and its treatment from `variant`; the message reads "background-color is owned by the variant
    and tone props" instead of picking a winner.
  - **A rule that styles a child is no longer attributed to the component.** `.z-tabs[data-variant="pill"]
    .z-tabs__list` styles the list, and Tabs does not own its radius. Only the compound a rule actually styles
    is read.
  - **A rule behind a pseudo-class is a state, not a prop.** `.z-card[data-interactive]:hover` sets a border
    color because the pointer is over it, which says nothing about which prop controls it.
  - **Reading a project's own source no longer guesses which element's attributes pass through.** The package
    path still guesses from a component's name and from `ComponentProps` without a literal, because a manifest
    derived from a stranger's `.d.ts` is better off with a likely answer than none. Source is not: this
    project's Dialog is a Radix dialog rather than an HTML one, and a wrong `extends` quietly widens what
    `unknown-prop` accepts.
  - **`zengin define --force`** resolves a disagreement in the stylesheet's favour instead of only reporting it,
    which is the right way round when the manifest was written by hand and has fallen behind the CSS.
  
  Zengin UI's own manifest is regenerated from its stylesheets and now disagrees with them nowhere.

## 0.3.0

### Minor Changes

- [`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99) Thanks [@Timurtek](https://github.com/Timurtek)! - `surfaces` in the config is now `profiles`.
  
  The name collided with the four surfaces the engine reaches you through, the MCP server, the editor hook,
  the CLI and the rollup, which the documentation and the site both use that word for. Two unrelated meanings
  of one word is a documentation problem that only gets worse, and the key was hours old with nobody depending
  on it, so it is renamed rather than lived with.
  
  Nothing else changed: the shape, the resolution order and what a profile may and may not do are the same. A
  config that still says `surfaces:` is refused by name, because ignoring it would check every file against the
  base system and look like the feature simply not working.

## 0.2.0

### Minor Changes

- [`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb) Thanks [@Timurtek](https://github.com/Timurtek)! - Two ways a system adapts without drifting.
  
  `zengin define` teaches the manifest about the components a project writes itself. A component under an
  ownership path had the contract and substitution rules switched off for its own file, which left the rest of
  the project unable to be held to it: a misspelled prop or an invented variant on your own component passed.
  The command reads the props from the component's TypeScript types, the defaults from its own destructuring,
  `extends` from the element whose attributes pass through, and `owns` from its stylesheet, attributing a
  property to the prop whose data attribute governs it. It exports the component from the system's barrel at the
  same time, because a definition nobody can import changes nothing. The merge never removes: a prop the source
  cannot see survives, a hand-declared enum beats a type the walker could not open, and a disagreement about who
  controls a property is reported rather than resolved.
  
  `surfaces` in the config declare that part of a project is a different design on purpose. A marketing page and
  an application are not the same design, and the only previous ways to say so were two systems or a suppression,
  which both spell a deliberate difference as drift. A surface may layer token values and change a component's
  props, `owns` and `className` policy; it may not add or remove components. Each file is checked against the
  first surface whose `include` matches it, so `shape="pill"` is correct on marketing and still a violation in the
  application, and the inventory records which surface checked each file.

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin init --from shadcn` derives Zengin definitions from a shadcn/ui project: semantic color tokens from the theme CSS (HSL triples and oklch converted), the radius scale, font families, Tailwind extend semantics, and one manifest entry per `components/ui` file with variants from `cva()`/`tv()`, sub-parts, Radix behavior props, replacements and owned properties. The engine's color normalizer now reads HSL.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - Icons as a vocabulary. Zengin UI exports `Icon`, sixty-three named glyphs (`Icon.Search`, `Icon.Close`, ...) drawn by Zengin UI until a set is chosen; its own components draw their chevrons, checks and close buttons from it. `zengin icons <set>` rewrites `src/lib/icons.tsx` so the same names come from a react-icons set (lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap; every mapping checked against the module's exports) and adds the dependency. The `Icon` manifest shadows the icon packages, so a direct import in app code is a component-substitution violation with the fix; `src/lib/**` is owned. The engine matches shadowed sources as globs (`react-icons/*#*`) and names the replacement's own import path in the fix. The marketing site's catalog gets an icon picker; previews swap sets at runtime with `setIconSet`.

- [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc) Thanks [@Timurtek](https://github.com/Timurtek)! - First public release of the Zengin conformance layer.
  
  - `@zenginui/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
  - `@zenginui/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
  - `@zenginui/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
  - `@zenginui/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.

- [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a) Thanks [@Timurtek](https://github.com/Timurtek)! - Cross-repository drift and adoption reporting. `zengin report` writes one repository's snapshot (violations plus an inventory of component usage, suppressions, owned forks, uncontracted components and the pinned version); `zengin rollup` aggregates snapshots into a ranked view with deltas against a previous rollup and a prioritised attention list, rendered as markdown, JSON or a self-contained HTML page. The engine exposes `inventory(files)`.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin upgrade`: every owned file's pragma now carries the hash of what was copied, so the command can tell a local edit from an upstream change. A report lists each file as current, upstream, local, conflict or unknown, with a diff for conflicts; `--write` takes upstream changes the project did not touch and moves the pinned version, `--force` takes upstream over a conflict. Stylesheets of components carry the pragma too; stories never do.
  
  `zengin create --framework next`: the App Router under `src/app` with the template's head and styles in `layout.tsx` and its `App` mounted client-side from `page.tsx`; `theme`, `fonts` and `brand` patch the layout's head as they patch `index.html`.
