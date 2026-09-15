# create-zengin

## 0.1.8

### Patch Changes

- Updated dependencies [[`f5d4f1c`](https://github.com/Timurtek/zengin/commit/f5d4f1cc31767f41c5ff04d47000328d43d1cec8), [`b01dc71`](https://github.com/Timurtek/zengin/commit/b01dc7148a5c2c300f54bb5ee6da5b6266afb0d9)]:
  - @zenginui/cli@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies [[`f6af9da`](https://github.com/Timurtek/zengin/commit/f6af9da9494417800e595c481dc5555e4b2b85f7)]:
  - @zenginui/cli@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies [[`89544b2`](https://github.com/Timurtek/zengin/commit/89544b2180ad802d4d27f2b547ba319b93d62d24)]:
  - @zenginui/cli@0.5.0

## 0.1.5

### Patch Changes

- Updated dependencies []:
  - @zenginui/cli@0.4.1

## 0.1.4

### Patch Changes

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
- Updated dependencies [[`983c4d0`](https://github.com/Timurtek/zengin/commit/983c4d0c4b7873ecfbd030fe2acb287a43acef63), [`fb3b596`](https://github.com/Timurtek/zengin/commit/fb3b596d806854c7de237480d06f0f362cde8c67), [`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/cli@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/cli@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb)]:
  - @zenginui/cli@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`f712538`](https://github.com/Timurtek/zengin/commit/f7125387b4fb21bb58b46c67b855962df0c48c1d)]:
  - @zenginui/cli@0.1.1
