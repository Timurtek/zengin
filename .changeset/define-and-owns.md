---
"@zenginui/adapter-css": minor
"@zenginui/cli": patch
---

`define` says what it did not find, stops deriving constants, and reads a prop that governs a part.

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
