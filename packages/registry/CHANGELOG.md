# @zenginui/registry

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
