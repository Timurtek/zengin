# @zenginui/cli

## 0.7.0

### Minor Changes

- [`b01dc71`](https://github.com/Timurtek/zengin/commit/b01dc7148a5c2c300f54bb5ee6da5b6266afb0d9) Thanks [@Timurtek](https://github.com/Timurtek)! - The enforcement loop is as wide as the ways an agent edits a file, and `doctor` says what it looked at.
  
  From the second field test, which ran with the hook alive for the first time and found that "the hook is
  wired" and "the work is checked" were still two different things.
  
  - **The hook now sees shell edits.** The matcher was `Write|Edit|MultiEdit` — a tool filter, so an agent told
    to use `sed` for small edits left the loop entirely and silently: six edits of sixteen in one measured
    session, two inside the checked scope. `Bash` is in the generated matcher now, and a shell payload names no
    file, so the working tree is asked instead: git for what changed, a content hash per file for what changed
    *since this hook last looked*. Pre-existing uncommitted work is not re-reported, and a project that is not
    a repository is told so rather than silently checked.
  
  - **`doctor` warns when the wiring sits below the repository root.** A session reads `.mcp.json` and the hook
    from the directory it opens in. When the app is a subdirectory — common — the files are valid, `doctor`
    said so and was right, and the hook still never fired. Validating a file is not checking that anything
    reads it.
  
  - **`doctor` names what it checked.** Passing checks printed nothing, so a healthy project looked like a
    three-line command that had examined the agent wiring and nothing else. It now lists the checks that ran
    and says plainly that judging your code is `zengin check`'s job.
  
  - **`doctor` reports custom properties your components read that nothing defines** — the project-level half
    of `token-reference`, and the finding that had `doctor` calling a project healthy while `check` exited 1.
    It makes the same allowance the rule makes for properties a dependency sets at runtime, derived from the
    project's own dependencies.
  
  - **Kanban leaves a control inside a card to handle its own keys.** `renderCard` is the extension point and a
    per-card menu is the common thing to put in it; Space on that button opened the menu *and* lifted the card
    from one keypress, and Escape afterwards was ambiguous.
  
  - **Combobox's doc comment is attached to Combobox again.** The fix for [#8](https://github.com/Timurtek/zengin/issues/8) inserted a helper between the
    component's JSDoc and the component, so the exported component had none. A no-op filter is gone too.

### Patch Changes

- [`f5d4f1c`](https://github.com/Timurtek/zengin/commit/f5d4f1cc31767f41c5ff04d47000328d43d1cec8) Thanks [@Timurtek](https://github.com/Timurtek)! - `define` says what it did not find, stops deriving constants, and reads a prop that governs a part.
  
  - **A name that matched nothing is reported, and the command exits 1.** `zengin define Shell StatCard`
    answered "The manifest already describes this source" at exit 0 for two components it had never seen —
    they sit outside the ownership paths, which is correct behaviour and the wrong message. It now names them,
    says which paths were searched, and explains that a component outside them is the application's rather than
    the system's.
  
  - **A SCREAMING_CASE export is not a component.** `TONES` in a lib module arrived in the manifest as a
    component with no props, and one false positive in a batch blocks the whole `--write`.
  
  - **A prop on the root that switches a part's property is recorded as owning it.** `.z-field[data-font="mono"]
    .z-field__input { font-family }` read as unowned, because only the compound a rule directly styles was
    examined — so `define --force` would have set the owner to null and undone the `font="mono"` prop the
    manifest exists to point people at.
  
    **This reverses an earlier reading, deliberately.** `owns` answers one question: which prop should a reader
    reach for when their `className` is rejected. For a rejected `className="mono"` on a field the answer is
    `font`, whether the declaration lands on the root or on a part of it; the earlier rule distinguished by
    which element is styled, which is not the question a reader is asking. Two narrowings keep the old false
    positives out: only a data attribute on the subject's own BEM block counts, and a rule behind a
    pseudo-class is still a state rather than a prop.
  
    The deriver consequently finds owners in Zengin UI's own stylesheets that its manifest records as null
    (Tabs' radius under `variant`, EmptyState's colour under `tone`, and four more). They are reported as
    disagreements and the manifest is kept, which is the designed default; adopting them is a separate call.
- Updated dependencies [[`f5d4f1c`](https://github.com/Timurtek/zengin/commit/f5d4f1cc31767f41c5ff04d47000328d43d1cec8), [`b01dc71`](https://github.com/Timurtek/zengin/commit/b01dc7148a5c2c300f54bb5ee6da5b6266afb0d9)]:
  - @zenginui/adapter-css@0.4.0
  - @zenginui/registry@0.5.0

## 0.6.0

### Minor Changes

- [`f6af9da`](https://github.com/Timurtek/zengin/commit/f6af9da9494417800e595c481dc5555e4b2b85f7) Thanks [@Timurtek](https://github.com/Timurtek)! - The definitions a project owns can be carried forward, so `add` stops leaving a project failing its own check.
  
  Found by the session building TekJobs on Zengin: `zengin add combobox` installed a stylesheet reading
  `var(--tracking-wider)` into a project created before the `tracking` family existed. The token resolved to
  nothing at runtime, the engine correctly failed the project, and `zengin upgrade` had just reported
  "everything is what the registry ships" — because it compares files carrying an ownership pragma, and
  `zengin/tokens.json` carries none. JSON has no comments, so the definitions sat outside upgrade's world
  entirely. The component was current; the definitions were a release behind; nothing compared them.
  
  **`add` now carries the tokens an arriving component actually reads**, from the same registry and the same
  version as the component, and names them in its output because `zengin/tokens.json` is the project's own file.
  
  **`upgrade` now reports the definitions too**, compared token by token rather than file by file: what the
  registry defines and the project lacks, and — separately, and left alone — the tokens the project gave its own
  values. A brand is the point of owning your definitions, so `--write` is additive and never touches a value
  you changed.
  
  This was the third create-time artifact with no upgrade path, after the agent wiring and the version pins.

### Patch Changes

- Updated dependencies [[`f6af9da`](https://github.com/Timurtek/zengin/commit/f6af9da9494417800e595c481dc5555e4b2b85f7)]:
  - @zenginui/registry@0.4.0

## 0.5.0

### Minor Changes

- [`89544b2`](https://github.com/Timurtek/zengin/commit/89544b2180ad802d4d27f2b547ba319b93d62d24) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin doctor`: is this project's plumbing what this version of Zengin expects?
  
  Every other command answers a question about the code. This one answers a question about the project, and it
  exists because of a fault the others cannot see: a project is wired to Zengin once, when it is created, and
  never again. `zengin upgrade` carries the owned components forward; the agent wiring, the version pins and the
  generated files have no upgrade path at all, so a project created before a fix keeps that fault for as long as
  it lives and nothing tells it.
  
  Projects created before 0.4.0 wrote the MCP server and the edit hook as bare binaries an agent cannot launch.
  Their enforcement loop never ran — and a loop that never runs looks exactly like a project that never drifts.
  The first report of it came from a session that had spent a day building against a design system with the hook
  silently dead.
  
  It checks the agent wiring (present, and in a form an agent can launch), the version pins against what this
  Zengin pins, the definitions, the generated token stylesheet, and whether every component on disk is in the
  manifest, the barrel and the stylesheet index. An error means configured and broken; a warning means absent or
  deliberate. It exits 1 on an error, so CI can run it. Everything is local: no network, no clock, same answer
  every time — component drift against the registry stays `zengin upgrade`'s question.
  
  `--fix` repairs the files Zengin itself writes, leaving other MCP servers and other hooks alone, then looks
  again and reports what is true afterwards rather than what was wrong before. It will not touch dependencies:
  changing a pin means running an install, so it prints the command instead.
  
  `AGENT_WIRING` is now one exported constant in the registry: `create` writes it and `doctor` checks it, so the
  two cannot drift apart.
  
  It also catches a hook declared as a command plus an `args` array. The hook schema has one string field, so
  only `command` is read and the rest is dropped: the hook runs `node` with no script, or nothing at all. Both
  of Zengin's own examples were wired that way, which means the edit hook had never fired in this repository
  either — found by running the new command on them.

### Patch Changes

- Updated dependencies [[`89544b2`](https://github.com/Timurtek/zengin/commit/89544b2180ad802d4d27f2b547ba319b93d62d24)]:
  - @zenginui/registry@0.3.0

## 0.4.1

### Patch Changes

- Updated dependencies [[`b233040`](https://github.com/Timurtek/zengin/commit/b2330409ef24fa92506f858c000768979c75c70a)]:
  - @zenginui/registry@0.2.1

## 0.4.0

### Minor Changes

- [`fb3b596`](https://github.com/Timurtek/zengin/commit/fb3b596d806854c7de237480d06f0f362cde8c67) Thanks [@Timurtek](https://github.com/Timurtek)! - The rest of field test four.
  
  **`add` no longer throws a batch away for one typo.** `zengin add markdown tabs codeblock skeleton loader`
  added nothing, because one name in five was `codeblock` rather than `code-block`. The four valid items go in
  now and the one that is wrong is reported with the registry's own name for it: `did you mean code-block?`.
  The full list of items stays in the error too, because that is how someone finds a name the suggestion
  misses.
  
  **`add --install` runs the package manager** the project already uses, read from its lockfile. Without the
  flag it prints the command, and now also says what to expect until someone runs it: TypeScript will report
  the missing module and a second error inside the story that uses it, and both go away with the install. That
  second error read as a broken registry item to the session that found it.
  
  **`npm create zengin -- --help` answers the question that was asked.** It forwarded to the whole CLI, so
  someone who wanted to create a project got every command from `check` to `figma plugin`, with the create
  flags two screens down.
  
  **A monospace text control.** `TextField` and `TextArea` take `font="mono"`, for content that is code or
  data rather than prose: a JSON block, an API key, a path. There was no way to do this before, because the
  controls own their font through `size`, so a config-editing screen had to reach for a `className` and was
  correctly blocked. The manifest now says `font-family` is owned by the `size` and `font` props, so the
  violation names the prop that actually helps.
  
  **Letter-spacing tokens.** A `tracking` family, from `tighter` to `caps`, and every hardcoded value in the
  examples now names one. Uppercase micro-labels are common enough to deserve a token, and an agent reaching
  for `var(--tracking-wide)` will now find it.
  
  **Four components an operator app had to build by hand.** `DataTable` sorts, searches and pages over
  `Table`, sorting on the column's value rather than the text in the cell, so a formatted date or a badge
  sorts correctly; it tells the difference between having no rows and matching none. `StatTile` colours a
  change by what the metric means rather than by the sign of the number, because a fall in churn is good and a
  fall in revenue is not. `EmptyState` gives the three different nothings, not yet, no match, and all clear,
  somewhere to live. `Kbd` renders a key or a chord.

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

### Patch Changes

- [`983c4d0`](https://github.com/Timurtek/zengin/commit/983c4d0c4b7873ecfbd030fe2acb287a43acef63) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin --help` attributes its options to the right command.
  
  The Init block had lost its last two lines into Define, so `--dir` was listed twice under Define and
  `--force` appeared there with init's description, "overwrite existing zengin/ definitions and config".
  Anyone reading the help to find out what `zengin define --force` does was told the wrong thing about
  the one flag whose whole job is to overwrite something.
- Updated dependencies [[`fb3b596`](https://github.com/Timurtek/zengin/commit/fb3b596d806854c7de237480d06f0f362cde8c67), [`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`1e16ddc`](https://github.com/Timurtek/zengin/commit/1e16ddcc26e9fb27a6b16898f55c6e9ff2931d6c), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/registry@0.2.0
  - @zenginui/engine@0.4.0
  - @zenginui/adapter-css@0.3.0
  - @zenginui/adapter-shadcn@0.1.3
  - @zenginui/figma@0.1.3
  - @zenginui/rollup@0.1.3

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

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/engine@0.3.0
  - @zenginui/adapter-css@0.2.1
  - @zenginui/adapter-shadcn@0.1.2
  - @zenginui/figma@0.1.2
  - @zenginui/registry@0.1.3
  - @zenginui/rollup@0.1.2

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

### Patch Changes

- Updated dependencies [[`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb)]:
  - @zenginui/engine@0.2.0
  - @zenginui/adapter-css@0.2.0
  - @zenginui/registry@0.1.2
  - @zenginui/adapter-shadcn@0.1.1
  - @zenginui/figma@0.1.1
  - @zenginui/rollup@0.1.1

## 0.1.1

### Patch Changes

- [`f712538`](https://github.com/Timurtek/zengin/commit/f7125387b4fb21bb58b46c67b855962df0c48c1d) Thanks [@Timurtek](https://github.com/Timurtek)! - The public registry moved to https://zengin.timurtek.com/r, the site's own domain. The old vercel.app address keeps serving the registry for installed copies.
- Updated dependencies [[`f712538`](https://github.com/Timurtek/zengin/commit/f7125387b4fb21bb58b46c67b855962df0c48c1d)]:
  - @zenginui/registry@0.1.1

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin init --from shadcn` derives Zengin definitions from a shadcn/ui project: semantic color tokens from the theme CSS (HSL triples and oklch converted), the radius scale, font families, Tailwind extend semantics, and one manifest entry per `components/ui` file with variants from `cva()`/`tv()`, sub-parts, Radix behavior props, replacements and owned properties. The engine's color normalizer now reads HSL.

- [`46c9785`](https://github.com/Timurtek/zengin/commit/46c9785cef6a6a2765043d32eb34098584ebd343) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/figma`: tokens to a Figma Variables payload and back with a report, Code Connect files from the component manifest, and a plugin that imports and exports variables in any Figma file. `zengin figma export | import | connect | plugin` in the CLI.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin fonts`: ten curated Google Fonts pairings in the registry (`fonts-<name>`, three roles each: headlines, text, code, at the weights the components use). `zengin fonts <name>` rewrites the three font tokens in `src/theme/brand.css` and the fonts link in `index.html`, nothing else; `--self-host` downloads the woff2 files into `public/fonts` and writes `src/theme/fonts.css`; `zengin brand --fonts <name>` takes a pairing in place of the three families. `fontsHref` accepts `Family:400;700` to pin weights. The marketing site's catalog gets a font picker beside the theme picker.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - Icons as a vocabulary. Zengin UI exports `Icon`, sixty-three named glyphs (`Icon.Search`, `Icon.Close`, ...) drawn by Zengin UI until a set is chosen; its own components draw their chevrons, checks and close buttons from it. `zengin icons <set>` rewrites `src/lib/icons.tsx` so the same names come from a react-icons set (lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap; every mapping checked against the module's exports) and adds the dependency. The `Icon` manifest shadows the icon packages, so a direct import in app code is a component-substitution violation with the fix; `src/lib/**` is owned. The engine matches shadowed sources as globs (`react-icons/*#*`) and names the replacement's own import path in the fix. The marketing site's catalog gets an icon picker; previews swap sets at runtime with `setIconSet`.

- [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc) Thanks [@Timurtek](https://github.com/Timurtek)! - First public release of the Zengin conformance layer.
  
  - `@zenginui/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
  - `@zenginui/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
  - `@zenginui/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
  - `@zenginui/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.

- [`cf35643`](https://github.com/Timurtek/zengin/commit/cf35643dade7f24efe20a68eb867faa58331f0d0) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/mock` and `zengin mock`: typed, seeded mock data generated as plain TypeScript into `src/mock`, from presets (users, customers, companies, products, orders, invoices, events, messages, metrics) or a schema of your own.

- [`7c1e990`](https://github.com/Timurtek/zengin/commit/7c1e99058b9ef309c267f3ea57b9aaec1a9bd3d3) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin create <dir> --template blank|marketing|review` scaffolds a project that owns its components shadcn-style: files copied in with the owned pragma, definitions in `zengin/`, the engine, MCP server, hook and Storybook wired from the first commit. `zengin add <items>` pulls more components or templates from the registry. `zengin tokens` compiles the token JSON to CSS. `zengin registry build` produces the registry the marketing site serves.

- [`9af7637`](https://github.com/Timurtek/zengin/commit/9af7637026f94b3d3ef9af81fdd263acf58b5c21) Thanks [@Timurtek](https://github.com/Timurtek)! - Rollup history and hosted trends. `zengin report --into <dir>` files each snapshot as `<dir>/<repo>/<time>.json`; `zengin rollup <dir>` reads a directory as history: the newest run per repository is the current row, the one before it is the delta (no `--previous` needed), and the whole series is the trend. The result carries `history` with every run per repository and as-of totals; the HTML page draws violations, component uses and suppressions over time and a sparkline per repository, the markdown gets a trend column. `--at`, `--commit` and `--ref` on `zengin report` stamp backfilled snapshots. `--out` creates its directory. Zengin's own examples report on every push to main and the marketing site serves the rollup at /rollup/.

- [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a) Thanks [@Timurtek](https://github.com/Timurtek)! - Cross-repository drift and adoption reporting. `zengin report` writes one repository's snapshot (violations plus an inventory of component usage, suppressions, owned forks, uncontracted components and the pinned version); `zengin rollup` aggregates snapshots into a ranked view with deltas against a previous rollup and a prioritised attention list, rendered as markdown, JSON or a self-contained HTML page. The engine exposes `inventory(files)`.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

- [`4838fdc`](https://github.com/Timurtek/zengin/commit/4838fdca1a5dd78fd36738d94296353954d9bd6f) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin theme [name]` lists the registry's themes or swaps the project's brand for one; `zengin create --theme` applies one at creation. `zengin brand --name <name> [--logo] [--primary] [--font-*] [--radius]` derives a whole brand from one color in OKLCH, pushed to WCAG AA in both schemes, with the logo, favicon, wordmark and index.html patched. Zengin UI ships four themes: default, meadow, plex, spec-sheet.

- [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin upgrade`: every owned file's pragma now carries the hash of what was copied, so the command can tell a local edit from an upstream change. A report lists each file as current, upstream, local, conflict or unknown, with a diff for conflicts; `--write` takes upstream changes the project did not touch and moves the pinned version, `--force` takes upstream over a conflict. Stylesheets of components carry the pragma too; stories never do.
  
  `zengin create --framework next`: the App Router under `src/app` with the template's head and styles in `layout.tsx` and its `App` mounted client-side from `page.tsx`; `theme`, `fonts` and `brand` patch the layout's head as they patch `index.html`.

### Patch Changes

- [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071) Thanks [@Timurtek](https://github.com/Timurtek)! - Three more templates in the registry: `auth` (sign in, create account, reset and verify, validated against mock accounts), `docs` (sections in a sidebar, markdown pages with code and tables, an outline, search, previous and next, per-page metadata from mock rows) and `storefront` (a product grid with search, filters and sort, a cart sheet with quantities and totals, a checkout dialog; stock, ratings and sale flags from mock rows). Each ships its `mock.json` and gets a `mock` script when created.
- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`edc989d`](https://github.com/Timurtek/zengin/commit/edc989d8d988788ac99955834bd0eb4e118f8b6e), [`46c9785`](https://github.com/Timurtek/zengin/commit/46c9785cef6a6a2765043d32eb34098584ebd343), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`cf35643`](https://github.com/Timurtek/zengin/commit/cf35643dade7f24efe20a68eb867faa58331f0d0), [`7c1e990`](https://github.com/Timurtek/zengin/commit/7c1e99058b9ef309c267f3ea57b9aaec1a9bd3d3), [`cb96ccf`](https://github.com/Timurtek/zengin/commit/cb96ccf0e751dec80cc833fcaf7c2fb0dd5caa16), [`9af7637`](https://github.com/Timurtek/zengin/commit/9af7637026f94b3d3ef9af81fdd263acf58b5c21), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`4924af2`](https://github.com/Timurtek/zengin/commit/4924af241d9408768d67938d142340874d151bb3), [`cbc2984`](https://github.com/Timurtek/zengin/commit/cbc2984c1c4e490dd1795809f88f9ccd0292f905), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`4374ef7`](https://github.com/Timurtek/zengin/commit/4374ef72a6226518220b2853345b8c2b1e4402ee), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071), [`4838fdc`](https://github.com/Timurtek/zengin/commit/4838fdca1a5dd78fd36738d94296353954d9bd6f), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/adapter-css@0.1.0
  - @zenginui/engine@0.1.0
  - @zenginui/registry@0.1.0
  - @zenginui/adapter-shadcn@0.1.0
  - @zenginui/figma@0.1.0
  - @zenginui/mock@0.1.0
  - @zenginui/rollup@0.1.0
