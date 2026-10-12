# Field test: three Claude Design exports (FakeOrders, PainSense, AstroSense)

**Date** 2026-10-12. **Subjects** three design systems exported from Claude Design, unrelated to each other and to shadcn: **FakeOrders** (a commerce app kit, 12 components, 141 tokens, one theme), **PainSense** (a pain-tracking app, 33 components, 135 tokens, a `night` theme), **AstroSense** (an astrology product, 9 components, 84 tokens, a `light` theme over a dark default). Each is a folder: `_ds_manifest.json`, five token stylesheets, a `.jsx` and a `.d.ts` per component, a `_adherence.oxlintrc.json`, and a UI kit that uses the components. Read from `Downloads/`; every run was on a temporary copy, nothing in the exports was written to.

This is the fourth Zengin field test, not the third: taxonomy, ai-chatbot and [umami](2026-09-12-umami.md) came first, and umami is already a non-shadcn system with its own adapter. What is new is the **source**: a design tool's export, not a package or a shadcn project. The packet that asked for this was written before the umami result was counted, which is why it calls this the third.

## The falsifier

The packet's falsifier is cut off in its frontmatter (`TEST IT BEFORE BUILDING ANYTHING: export a SECOND, unrelated design system from Claude Design`). It was answered against two further exports, PainSense and AstroSense, before the adapter was written. **The shape generalises; the contents of the fields do not.** The manifest diff:

| | FakeOrders | PainSense | AstroSense |
|---|---|---|---|
| top-level keys | 11 | 12 (adds `hasThumbnailHtml`) | 12 (adds `hasThumbnailHtml`) |
| `components[]` | `{name, sourcePath}`, 12 | same, 33; `ListRow` and `ListGroup` share one `.jsx` | same, 9 |
| `tokens[]` | 141, one per variable | 135 listed, **26 carry `scope`** (the `night` overrides, same names as the base tokens) | 112 listed, **28 carry `scope`** |
| `kind` values used | color, font, spacing, shadow, other | adds `radius` | adds `radius`; no `other` |
| `themes[]` | **empty** | `[data-theme="night"]` | `:root[data-theme="light"]`, the *light* theme over a dark default |
| `fonts[]` | 7 files | **empty** | **empty** |
| `startingPoints[]` | empty | 4 | empty |

What stayed fixed: `namespace`, `components[].sourcePath` to a `.jsx` with a sibling `.d.ts`, `globalCssPaths`, and the `.d.ts` shape (`interface XProps`, `declare function X`). The adapter reads only those, plus `themes[].selector`. Had the contract fields moved, the adapter half would have been dropped and this report would say so.

## What was built

`zengin init --from claude-design [--dir <export>]`, in `@zenginui/adapter-css` (`src/claude-design.ts`). It is not a new package: it reuses the stylesheet reader and the `.d.ts` reader that adapter already has, and a new package would have needed publishing, which is out of scope.

- **Tokens** come from the stylesheets named in `globalCssPaths`, variable names kept, aliases resolved through the chain (`--brand` → `var(--coral-500)` → `#FF4D3D`). Themes come from `themes[].selector`.
- **`kind` is not the classifier.** The manifest's `kind` is compared with what the value says and every disagreement is reported. Across the three exports it is wrong on **25 / 25 / 13** variables: font sizes arrive as `spacing` (`--fs-display: 40px`; all nine `--fs-*` in FakeOrders, all fifteen in PainSense), text colors as `font` (`--text-strong`), radii as `spacing` in FakeOrders, border widths as `spacing`, RGB triplets and gradients as `color`. Classification is from the value first and the name second, the same order `adapter-css` already used, with six name rules added (below).
- **Components** come from each component's `.d.ts`, one file per manifest entry. `components[]` carries no props, as the packet warned.
- **Contracts are cross-checked** against `_adherence.oxlintrc.json`: the allowed props and enum values are read back out of the oxlint selectors and compared with the `.d.ts`. Disagreements are reported and neither side wins.
- Written to `zengin/tokens.json`, `zengin/components.json`, `zengin.config.yaml` (and `tokens.dark.json` when the manifest names a theme). Refuses to overwrite without `--force`.

Reproduce: `pnpm -r build && node scripts/field-test-claude-design.mjs "<export folder>"`. It copies the export to a temp directory, runs `init`, then `check`, and prints counts and each distinct finding once. The exports are not in the repository; the adapter's tests run on a small synthetic export in `packages/adapter-css/test/fixtures/claude-design/`.

## Is `.d.ts` more reliable than `cva()`?

Yes, with one limit. Every component in all three exports had a `.d.ts` and every one parsed (54 of 54), with enum values inline in the type (`tone?: "deal" | "scarcity" | ...`), so the `VariantProps<typeof x>` indirection the umami run needed never arose and no `passthrough` was recorded. The limit: **a `.d.ts` states what the author wrote, and they are hand-written.** The cross-check found the two sources disagreeing:

| export | disagreements | what |
|---|---|---|
| FakeOrders | 2 | `<TabItem>` has an adherence contract but is not a manifest component (a sub-component of `TabBar`); `TabBar` has `.d.ts` props and **no adherence contract**, so nothing stops an unknown prop on it |
| PainSense | 3 | `SegmentedOption` contract but no component; `Segmented` and `ListRow` have no contract |
| AstroSense | 5 | `EphemerisRow` and `NatalWheelBody` contracts but no components; `EphemerisTable`, `NatalWheel` and `Footer` have no contract |

**There was no prop-level or enum-level disagreement in any of the three: where both sources describe a component, they agree exactly.** That is because both were generated from the same source by the same tool, so agreement is weaker evidence than it looks. The disagreements that exist are all about *coverage*: the oxlint config silently skips components (and invents sub-components), which is the proto-Zengin failing the way the packet said.

## Proto-Zengin: where the hand-written adherence config stops

`_adherence.oxlintrc.json` is a weaker Zengin built before Zengin existed. Verified against the three files (33, 54 and 17 `no-restricted-syntax` selectors, of which 30, 51 and 14 are per-component):

| it does | it cannot |
|---|---|
| flags `/#[0-9a-fA-F]{3,8}/` | see `rgb()`, `oklch()` or named colors. FakeOrders' own shadows are `rgba()`, and its own components contain `rgba(26,20,16,0.42)`. |
| flags `/\b\d+px\b/` | tell `--fs-body: 16px` or an offset from spacing. It has no notion that `gap: 12` is `--sp-3`. |
| says "use a token" | say **which**. The engine's fix is `var(--sp-3)`; the config's is a sentence. |
| declares `<Badge>`'s enums | do it without ~2 to 5 selectors per component: FakeOrders spends 30 selectors on 12 contracts, PainSense 51 on 32, AstroSense 14 on 8, and each skips the components listed above |
| reserves `react/forbid-elements` | fill it. `"forbid": []` is empty in **all three** exports |
| `warn` | block. Every rule is `warn` in all three |

It also cannot see how the components are used. The kits do not import them: `const { Button } = window.FakeOrdersDesignSystem_83fb12`. A selector on `JSXOpeningElement[name.name='Badge']` matches either way, but nothing resolves where `Badge` came from.

## First runs

| export | first run | validated (second run) | spacing | color | token-reference |
|---|---|---|---|---|---|
| FakeOrders | 137 | 137 | 121 | 15 | 1 |
| PainSense | 165 | 162 | 154 | 8 | 0 |
| AstroSense | 34 | 26 | 25 | 1 | 0 (was 8) |
| **total** | **336** | **325** | | | |

The FakeOrders "first run" is the first run that completed: the very first attempt stopped on `system.version not set` (a Claude Design export has no version, so the config now says `0.0.0`), and the first derivation report was read and corrected before it was run (the adapter defects below). PainSense and AstroSense were run after the FakeOrders engine fixes (spacing step, translucent colors), so their first-run figures do not contain the defects FakeOrders had already surfaced; they are first runs of the adapter, not of the engine as it stood before this work. Findings were classified by hand **as distinct kinds** (rule, found value, fix), 81 + 55 + 22 = 158 of them (an earlier draft of this report said 70 for FakeOrders; the script's count is 81), with each kind's count, and each classification was then **checked against a sample of the individual findings** (below). Each kind is one of: true by rule, engine defect, adapter defect, policy gap.

### The sample, so it can be checked

Tek's rule for this report (2026-10-12): every kind classified, plus a hand-checked sample from each kind; classifying all 336 one by one is not required.

- **Sample rule:** for every kind, the first, the middle and the last finding of that kind, in the order `zengin check` reports them. A kind with three or fewer findings is therefore opened in full.
- **What opening a finding meant:** reading the cited `file:line` in the export and confirming that line holds the flagged literal and that the classification above fits the context (a true literal, a fix that names a scale step, a fix that keeps transparency).
- **What was sampled:** the findings of the current engine, which are the second-run 325 (137 + 162 + 26). The 11 first-run findings that no longer appear (3 PainSense and 8 AstroSense, the `Unknown token --fg` reports and similar, see the defects above) are not in the sample; they were each a named adapter or engine defect, and their fixes carry regression tests.
- **Result:** 235 of the 325 findings opened (FakeOrders 116 of 137, PainSense 93 of 162, AstroSense 26 of 26). Every kind has at least one opened finding. In all 235 the flagged text was on the cited line. No sampled finding contradicted its kind's classification.
- **The sample list is reproducible, not retyped here:** `pnpm -r build && node scripts/field-test-claude-design.mjs "<export>" --sample` prints, per kind, its count and the `file:line` of each finding opened, and marks `ok` where the line holds the flagged text. It ends with `81 kinds, 116 findings opened, 0 not found in source` (FakeOrders), `55 kinds, 93 findings opened, 0 not found` (PainSense) and `22 kinds, 26 findings opened, 0 not found` (AstroSense). The sample is deterministic for a given export.
- **What the sample is not:** the 90 findings in kinds of four or more that fall between the first, middle and last were not opened. They are covered by the kind's classification and by the sampled ones, which is the claim the sample supports, and no more.
- **Matcher correction:** the first run of the sample script reported 8 PainSense color findings "not found" because the script compared the engine's double-quoted `found` text to single-quoted source. That was the script, not the findings; it now strips the quotes, and the run above is after that fix.

### FakeOrders, 137

| Classification | Count | What |
|---|---|---|
| True by rule | 137 | Every finding is a literal that should be a token. 121 are inline-style spacing in the UI kit (114 in `ui_kits/app/*.jsx`) and **in the system's own components** (23 findings in `components/`): the design system does not use its own `--sp-*` scale. 15 color literals, 5 of them `#fff`. 1 `var(--mint-400, var(--mint-300))`: `--mint-400` exists nowhere in the export, and the fallback is what renders. A real bug in the export. |
| Engine defect | 71 | Two defects in the **fixes**, not the detection: (1) **61** spacing fixes named a token that is named for a use, not a step: `gap: 12` was told `var(--safe-top)`, `marginTop: 2` was told `var(--bw-chunky)` (a border width), `gap: 1` `var(--bw)`. Several tokens hold one value and the engine took whichever sorted last. (2) **10** color fixes dropped transparency: `rgba(255,255,255,0.92)` was told `var(--white)` as an *exact* match, `rgba(26,20,16,0.42)` `var(--ink-900)`, a gradient's `rgba(…,0.78)` stop an opaque ink. Both fixed. |
| Adapter defect | found before the first check | `--fs-*` read as spacing (9) and `--r-*` as spacing (8), `--ls-*` letter-spacing as spacing (3), `--bw*` border widths as spacing (3), `--sp-0: 0` unclassified, `cubic-bezier(...)` easings unclassified (3). Found by reading the derivation report, fixed before the check counted. |
| Policy gap | 11 | see below |

### PainSense, 165

| Classification | Count | What |
|---|---|---|
| True by rule | 162 | 154 spacing literals, 8 color literals. 77 findings are in the kit, 85 in the system's own components. |
| Engine defect | 3 | `oklch(var(--sevL) var(--sevC) 145)` reported as a color literal: the engine's color regex stops at the first `)` and read `oklch(var(--sevL)` as a literal. Its channels are the system's variables, so there is nothing to replace. Fixed. Same run: three `#fff` were told `var(--line)`, an 8%-opacity white, because a token's alpha was dropped when matching. Fixed, and the remaining `#fff` now gets `var(--ink)` as a *nearest* fix. |

### AstroSense, 34

| Classification | Count | What |
|---|---|---|
| True by rule | 26 | 25 spacing literals, 1 translucent color with no token. All in the three UI-kit screens. |
| Adapter defect | 8 | `rgba(var(--fg),0.9)` reported as `Unknown token --fg`. `--fg: 226,224,247` is an RGB triplet used as `rgba(var(--fg), alpha)`: the adapter did not recognise it as a variable at all, so `token-reference` flagged every use. Triplets and gradients (`--pageBg`) are now tokens of group `other`. |

## Changes made, each with a regression test

Engine (`packages/engine/test/spacing-steps.test.ts`, `translucent-colors.test.ts`): 65 → 72 tests.

- **Spacing fixes name the scale step.** Where the system names a scale (three or more tokens ending in a step: `sp-3`, `space-2h`, `spacing-xl`), an exact match prefers the step over a token named for a use (`--safe-top`, `--gutter`), and neighbours of an off-scale value come from the steps alone. A system with no named scale behaves as before.
- **A translucent color is not the opaque one.** `rgba()` with alpha below 1 normalises to an 8-digit hex and no longer matches `#ffffff`. A translucent literal with no token at that alpha is reported with no fix. Nearest-color matching does not cross alpha.
- **A color function whose channels are variables has no literal** (`oklch(var(--l) var(--c) 145)`).

Adapter (`packages/adapter-css/test/claude-design.test.ts`, new, 14 tests): 42 → 56.

- `deriveClaudeDesign`, `crossCheck`, `readAdherence`, the report, and an end-to-end test that checks a consumer file against the `.d.ts` contracts (`<Badge tone="hot" colour="red">` is an unknown value and an unknown prop; `<Button variant="primary" size="sm">` is clean; the fix for `gap: 16` is `var(--sp-4)`).
- `deriveTokensFromCss` takes `themeSelectors`. `classify` reads `--fs-*` as text, `--r-*` as radius, `--ls-*` and border widths as `other` (not space), a bare `0` by its name, easing functions and `.15s`, RGB triplets and gradients.

CLI: `zengin init --from claude-design`. Full workspace: `pnpm -r build` and `pnpm -r test` pass (engine 72, adapter-css 56, adapter-shadcn 19, cli 33, ui 125, mcp 20, registry 51, figma 26, rollup 12, hook 14, mock 5; the examples check clean and `review-workspace` still reports its 19).

## Second runs

| export | violations | exact | nearest | no fix | false positives |
|---|---|---|---|---|---|
| FakeOrders | 137 | 49 | 77 | 11 | 0 |
| PainSense | 162 | 139 | 14 | 9 | 0 |
| AstroSense | 26 | 11 | 14 | 1 | 0 |

**No count moved on FakeOrders**: the defects were in the fixes. What moved is that the 61 use-token fixes are 0 and the 10 alpha-dropping fixes are 0. **0 false positives by hand classification, with the caveat above** that the classification is by distinct kind.

## One theme, and no shadcn lineage

- **FakeOrders has one theme**: `themes: []`, no dark mode. Nothing about theme handling was exercised by it. Theme handling was exercised by PainSense (`night`) and AstroSense (`light`), and **AstroSense's named theme is the light one over a dark default**, so its `tokens.dark.json` holds light overrides. The engine treats the file as the second set of values to match, which is right, but the file name is wrong for that export.
- **No shadcn lineage in any of the three.** No Tailwind (`classes.tailwind: false`), no `cva()`, no `cn()`, no Radix; components are `.jsx` with inline styles and CSS custom properties. Styles are inline-style objects and CSS custom properties.

## What it does not cover

- **The component rules did not run on the exports' own code.** `unknown-prop`, `unknown-prop-value`, `classname-policy` and `component-substitution` need an import from the system, and the kits write `const { Button } = window.<namespace>`. They fire in the synthetic end-to-end test, which imports from the namespace; on the real kits their count is 0, and that says nothing about the kits. This is the largest gap: a coding agent working *in* a Claude Design project today is in this position. A `window.<namespace>` destructure as a source would close it, and is not built.
- **Shadows are matched as colors.** A `box-shadow` containing `rgba()` is reported by `color-literal` with no fix, but PainSense's `--shadow-toast`, `--shadow-knob` (twice) and `--shadow-thumb` are exactly the four values its components write. Four findings would have an exact fix under a shadow rule. A policy gap, not built.
- **"Nearest" can be zero.** `marginTop: 2` and `gap: 1` are offered `var(--sp-0)` (0px) as the nearest step, within the 4px rule. The note names the neighbours; the fix is a different design.
- **Negative margins** (`margin: '0 -20px'`) get no fix: there are no negative tokens.
- **Components inside the system are checked** (`components/**` is under `ownership`, which turns off contract rules, not literal rules). They are the system's own source and 23 + 85 findings sit there. Left on, because the system not following its own scale is a true finding; a team could move them to `foundations`.
- `kind` disagreements are reported as a count and a list, not corrected in the manifest.
- Three tokens whose value is a gradient or an easing are `other`: no rule reads that group.

## What it says

- The shape of a Claude Design export generalises across three unrelated systems; the *contents* of its fields do not (a manifest's `kind` was wrong on 25, 25 and 13 variables; `themes` is empty or not; `fonts` is empty or not).
- A design tool exporting its own contract twice (`.d.ts` and oxlint selectors) does not make them independent, and it does not make either complete. The oxlint config omits a component in each export (1 of 12, 2 of 33, 3 of 9) and states contracts for four that the manifest does not list.
- The engine found two real defects in the exports themselves: `var(--mint-400, …)` in FakeOrders, and the system's own components hard-coding the spacing it defines.
- Engine defects found by this run were all in **fixes** (a wrong token, a lost alpha), which is where a coding agent that applies fixes is most exposed.
