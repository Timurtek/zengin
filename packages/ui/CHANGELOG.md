# @zenginui/ui

## 0.2.3

### Patch Changes

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

## 0.2.2

### Patch Changes

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

## 0.2.1

### Patch Changes

- [`7cc1845`](https://github.com/Timurtek/zengin/commit/7cc1845af7db8418e3adfb3cfcb1491015b0b7ee) Thanks [@Timurtek](https://github.com/Timurtek)! - Combobox: an option list you can read, and option ids that are valid IDREFs.
  
  Both found by building a real screen on the component in a consumer project, and both shipped in the version
  that introduced it.
  
  - **The option list painted content on the modal scrim.** `--color-surface-overlay` is the 80%-alpha token a
    dialog sits on top of, so the page composited straight through the dropdown: 1.79:1 against the option
    labels in the light theme, where AA asks for 4.5:1. It is `--color-surface` now, like Menu, Select and
    Popover, which measures 17.85:1. A test now asserts the scrim appears in exactly two stylesheets, Dialog and
    Sheet, because the engine cannot catch this one: every token involved is real and used in a valid place, and
    what was wrong is which token was chosen.
  
  - **Option ids were built from option values.** An id may not contain whitespace and `aria-activedescendant`
    is a single IDREF, so an option value like `"Assembly AI"` silently stopped resolving and a screen reader
    read nothing as the user arrowed through the list. Nothing looked wrong: `getElementById` tolerates the
    space, and the visible highlight comes from an index. Ids are positions now, always id-safe, and the value
    moved to `data-value` where a test can read it. This is the failure the component's own doc comment says it
    exists to prevent.

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

### Patch Changes

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

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`edc989d`](https://github.com/Timurtek/zengin/commit/edc989d8d988788ac99955834bd0eb4e118f8b6e) Thanks [@Timurtek](https://github.com/Timurtek)! - The AI kit: `Conversation`, `Message`, `Markdown`, `CodeBlock`, `PromptInput`, `Reasoning`, `ToolCall`, `Sources`, `Suggestions`, `Loader`, in the shape of AI Elements and taking the Vercel AI SDK's message parts as they are. The `chat` template (`zengin create --template chat`) wires them with `useChat` and a scripted transport. Registry lib items are now named `lib-<name>`.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin fonts`: ten curated Google Fonts pairings in the registry (`fonts-<name>`, three roles each: headlines, text, code, at the weights the components use). `zengin fonts <name>` rewrites the three font tokens in `src/theme/brand.css` and the fonts link in `index.html`, nothing else; `--self-host` downloads the woff2 files into `public/fonts` and writes `src/theme/fonts.css`; `zengin brand --fonts <name>` takes a pairing in place of the three families. `fontsHref` accepts `Family:400;700` to pin weights. The marketing site's catalog gets a font picker beside the theme picker.

- [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844) Thanks [@Timurtek](https://github.com/Timurtek)! - Icons as a vocabulary. Zengin UI exports `Icon`, sixty-three named glyphs (`Icon.Search`, `Icon.Close`, ...) drawn by Zengin UI until a set is chosen; its own components draw their chevrons, checks and close buttons from it. `zengin icons <set>` rewrites `src/lib/icons.tsx` so the same names come from a react-icons set (lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap; every mapping checked against the module's exports) and adds the dependency. The `Icon` manifest shadows the icon packages, so a direct import in app code is a component-substitution violation with the fix; `src/lib/**` is owned. The engine matches shadowed sources as globs (`react-icons/*#*`) and names the replacement's own import path in the fix. The marketing site's catalog gets an icon picker; previews swap sets at runtime with `setIconSet`.

- [`2f82556`](https://github.com/Timurtek/zengin/commit/2f8255603e693bce3fb5cd19a582dd4e43da319f) Thanks [@Timurtek](https://github.com/Timurtek)! - Add `Tabs` (line and pill variants, two sizes, Radix behavior), a `font.display` token, display text sizes `4xl` to `6xl`, spacing steps `20`, `24` and `32`, and `leading.none`. Driven by the marketing page in `examples/marketing-site`.

- [`9734669`](https://github.com/Timurtek/zengin/commit/973466942b19b7285578d7b433ab14ea6a8ae936) Thanks [@Timurtek](https://github.com/Timurtek)! - The component set a SaaS dashboard needs: `Select`, `Switch`, `Toast` (with the `toast()` API), `Menu`, `Table`, `Avatar`, `Skeleton`, `Sheet`, `Popover`, `Progress`, `Separator`, `TextArea`. Each with a manifest entry, a story, tests, both themes, and reduced-motion handling. Twenty components in the registry.

- [`cbc2984`](https://github.com/Timurtek/zengin/commit/cbc2984c1c4e490dd1795809f88f9ccd0292f905) Thanks [@Timurtek](https://github.com/Timurtek)! - The SaaS dashboard template (`zengin create --template saas`), and what it brought into Zengin UI: `LineChart`, `BarChart` and `Sparkline` drawn in SVG on the tone tokens, the motion presets in `motion.css`, the breakpoint tokens, and `align` on `Button`. The registry ships every `src/internal` helper as a lib item and records template sources.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

- [`4838fdc`](https://github.com/Timurtek/zengin/commit/4838fdca1a5dd78fd36738d94296353954d9bd6f) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin theme [name]` lists the registry's themes or swaps the project's brand for one; `zengin create --theme` applies one at creation. `zengin brand --name <name> [--logo] [--primary] [--font-*] [--radius]` derives a whole brand from one color in OKLCH, pushed to WCAG AA in both schemes, with the logo, favicon, wordmark and index.html patched. Zengin UI ships four themes: default, meadow, plex, spec-sheet.

- [`8002509`](https://github.com/Timurtek/zengin/commit/80025096d020e3b446037b785d93755646cacd47) Thanks [@Timurtek](https://github.com/Timurtek)! - First release of the reference design system: Button, Badge, Card, TextField, Checkbox, Dialog and Tooltip in plain CSS with custom-property tokens, light and dark themes, Radix primitives for behavior, and the `zengin/` definitions (DTCG tokens and the component manifest) the engine enforces against.
