# @zenginui/registry

## 0.5.0

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

## 0.4.0

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

## 0.3.0

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

## 0.2.1

### Patch Changes

- [`b233040`](https://github.com/Timurtek/zengin/commit/b2330409ef24fa92506f858c000768979c75c70a) Thanks [@Timurtek](https://github.com/Timurtek)! - A created project pins the versions it was created from, and its Storybook is whole.
  
  Two faults found the way the last batch was found: by scaffolding a project from the published packages
  and using it, rather than from the checkout.
  
  - **`create` pinned `@zenginui/cli`, `@zenginui/hook` and `@zenginui/mcp` at `^0.1.0`.** One hand-written
    constant covered all three, so a project created after four releases still installed the first one:
    `zengin define`, `profiles:` and `add --install` were all documented, all released, and all missing from
    the project someone was handed. `npx zengin add card --install` inside a fresh project answered
    `Unknown option --install`. The versions are now generated from the workspace at build time, which runs
    after Changesets has set them, so a project pins what was published alongside it. A test reads the same
    package.json files rather than repeating the numbers, because a constant in a test goes stale exactly
    when the constant in the source does.
  
  - **A template now includes the components its own stories demonstrate.** `add` deliberately withholds a
    story whose requirements are not met, which is right when someone asked for one component and should not
    receive three. A template is the other case: it is a whole project, and its Storybook is that project's
    documentation of the system it owns, so a scaffold whose first output was "1 story was left out" reported
    a hole the person did not make. Across the eight templates this adds two components in total, Badge to
    blank and Checkbox to saas.

## 0.2.0

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

### Patch Changes

- [`1e16ddc`](https://github.com/Timurtek/zengin/commit/1e16ddcc26e9fb27a6b16898f55c6e9ff2931d6c) Thanks [@Timurtek](https://github.com/Timurtek)! - Kanban and Combobox, the last two components field test four asked for.
  
  **Kanban** is a board of columns you move cards between. Every operations app rebuilds this, and the rebuild
  is nearly always pointer-only: HTML5 drag events, a drop handler, done. That version cannot be used with a
  keyboard at all, and drag-and-drop has no accessible fallback of its own, so the keyboard path is the
  difference between a component and a demo. Space lifts a card, the arrow keys move it between and within
  columns, Enter drops it and Escape puts it back, with every step announced because the move cannot be seen.
  Both paths end in the same `onMove`. The board is controlled: it reports where a card should go and draws
  what it is given, so an app that needs to save the move, refuse it, or animate it stays in charge.
  
  **Combobox** is a text field that filters a list, for one value or several. Select is right up to a few
  dozen options; past that the answer is typing, which is a different component rather than a bigger Select.
  It follows the WAI-ARIA combobox pattern properly, which is the reason to have it in a system: focus stays
  in the input and owns the keyboard, the list is a real listbox, and the current option is pointed at with
  `aria-activedescendant` instead of by moving focus. Hand-rolled comboboxes usually get that last part wrong,
  and a screen reader then reads nothing as the user arrows through. Arrow keys wrap and step over disabled
  options, Backspace on an empty field takes the last chip, and groups, hints, an error and three sizes come
  with it.
  
  Also fixed: the story-requirements check counted type-only imports as components, so an item whose story
  imported its own `type KanbanMove` looked like it needed a component called KanbanMove. Types are erased at
  build time and can never be a missing component at runtime.
- Updated dependencies [[`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/engine@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/engine@0.3.0

## 0.1.2

### Patch Changes

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
- Updated dependencies [[`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb)]:
  - @zenginui/engine@0.2.0

## 0.1.1

### Patch Changes

- [`f712538`](https://github.com/Timurtek/zengin/commit/f7125387b4fb21bb58b46c67b855962df0c48c1d) Thanks [@Timurtek](https://github.com/Timurtek)! - The public registry moved to https://zengin.timurtek.com/r, the site's own domain. The old vercel.app address keeps serving the registry for installed copies.

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`edc989d`](https://github.com/Timurtek/zengin/commit/edc989d8d988788ac99955834bd0eb4e118f8b6e) Thanks [@Timurtek](https://github.com/Timurtek)! - The AI kit: `Conversation`, `Message`, `Markdown`, `CodeBlock`, `PromptInput`, `Reasoning`, `ToolCall`, `Sources`, `Suggestions`, `Loader`, in the shape of AI Elements and taking the Vercel AI SDK's message parts as they are. The `chat` template (`zengin create --template chat`) wires them with `useChat` and a scripted transport. Registry lib items are now named `lib-<name>`.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin fonts`: ten curated Google Fonts pairings in the registry (`fonts-<name>`, three roles each: headlines, text, code, at the weights the components use). `zengin fonts <name>` rewrites the three font tokens in `src/theme/brand.css` and the fonts link in `index.html`, nothing else; `--self-host` downloads the woff2 files into `public/fonts` and writes `src/theme/fonts.css`; `zengin brand --fonts <name>` takes a pairing in place of the three families. `fontsHref` accepts `Family:400;700` to pin weights. The marketing site's catalog gets a font picker beside the theme picker.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - Icons as a vocabulary. Zengin UI exports `Icon`, sixty-three named glyphs (`Icon.Search`, `Icon.Close`, ...) drawn by Zengin UI until a set is chosen; its own components draw their chevrons, checks and close buttons from it. `zengin icons <set>` rewrites `src/lib/icons.tsx` so the same names come from a react-icons set (lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap; every mapping checked against the module's exports) and adds the dependency. The `Icon` manifest shadows the icon packages, so a direct import in app code is a component-substitution violation with the fix; `src/lib/**` is owned. The engine matches shadowed sources as globs (`react-icons/*#*`) and names the replacement's own import path in the fix. The marketing site's catalog gets an icon picker; previews swap sets at runtime with `setIconSet`.

- [`7c1e990`](https://github.com/Timurtek/zengin/commit/7c1e99058b9ef309c267f3ea57b9aaec1a9bd3d3) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin create <dir> --template blank|marketing|review` scaffolds a project that owns its components shadcn-style: files copied in with the owned pragma, definitions in `zengin/`, the engine, MCP server, hook and Storybook wired from the first commit. `zengin add <items>` pulls more components or templates from the registry. `zengin tokens` compiles the token JSON to CSS. `zengin registry build` produces the registry the marketing site serves.

- [`cb96ccf`](https://github.com/Timurtek/zengin/commit/cb96ccf0e751dec80cc833fcaf7c2fb0dd5caa16) Thanks [@Timurtek](https://github.com/Timurtek)! - Template items carry a `source` field naming the example app they are derived from; the `blank` template is now derived from `examples/blank` like the others; the `default` theme is generated from the token files so applying it resets every token.

- [`4924af2`](https://github.com/Timurtek/zengin/commit/4924af241d9408768d67938d142340874d151bb3) Thanks [@Timurtek](https://github.com/Timurtek)! - The SaaS template runs on `zengin mock` data: `mock.json` in the template declares customers, invoices, events, signups and a daily metric, `src/mock` holds the generated rows, and `src/data.ts` derives MRR, signups by month and relative times on top. A template that ships `mock.json` gives the created project a `mock` script (`zengin mock --schema mock.json`). Generated modules import only the runtime helpers they use.

- [`cbc2984`](https://github.com/Timurtek/zengin/commit/cbc2984c1c4e490dd1795809f88f9ccd0292f905) Thanks [@Timurtek](https://github.com/Timurtek)! - The SaaS dashboard template (`zengin create --template saas`), and what it brought into Zengin UI: `LineChart`, `BarChart` and `Sparkline` drawn in SVG on the tone tokens, the motion presets in `motion.css`, the breakpoint tokens, and `align` on `Button`. The registry ships every `src/internal` helper as a lib item and records template sources.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

- [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071) Thanks [@Timurtek](https://github.com/Timurtek)! - Three more templates in the registry: `auth` (sign in, create account, reset and verify, validated against mock accounts), `docs` (sections in a sidebar, markdown pages with code and tables, an outline, search, previous and next, per-page metadata from mock rows) and `storefront` (a product grid with search, filters and sort, a cart sheet with quantities and totals, a checkout dialog; stock, ratings and sale flags from mock rows). Each ships its `mock.json` and gets a `mock` script when created.

- [`4838fdc`](https://github.com/Timurtek/zengin/commit/4838fdca1a5dd78fd36738d94296353954d9bd6f) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin theme [name]` lists the registry's themes or swaps the project's brand for one; `zengin create --theme` applies one at creation. `zengin brand --name <name> [--logo] [--primary] [--font-*] [--radius]` derives a whole brand from one color in OKLCH, pushed to WCAG AA in both schemes, with the logo, favicon, wordmark and index.html patched. Zengin UI ships four themes: default, meadow, plex, spec-sheet.

- [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin upgrade`: every owned file's pragma now carries the hash of what was copied, so the command can tell a local edit from an upstream change. A report lists each file as current, upstream, local, conflict or unknown, with a diff for conflicts; `--write` takes upstream changes the project did not touch and moves the pinned version, `--force` takes upstream over a conflict. Stylesheets of components carry the pragma too; stories never do.
  
  `zengin create --framework next`: the App Router under `src/app` with the template's head and styles in `layout.tsx` and its `App` mounted client-side from `page.tsx`; `theme`, `fonts` and `brand` patch the layout's head as they patch `index.html`.

### Patch Changes

- [`4374ef7`](https://github.com/Timurtek/zengin/commit/4374ef72a6226518220b2853345b8c2b1e4402ee) Thanks [@Timurtek](https://github.com/Timurtek)! - The review and chat templates run on `zengin mock` rows: `mock.json` in each declares the queue's reviews (author, status, submitted) and the sidebar's threads (when, turns); `src/data.ts` pairs the rows with a catalog of prose, since a sentence from a word pool is not a review title. Both ship the schema and get a `mock` script when created.
- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
