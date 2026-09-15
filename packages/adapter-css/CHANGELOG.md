# @zenginui/adapter-css

## 0.4.0

### Minor Changes

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

## 0.3.0

### Minor Changes

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

- Updated dependencies [[`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/engine@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/engine@0.3.0

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

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
