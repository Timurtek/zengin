---
"@zenginui/ui": patch
---

Combobox: an option list you can read, and option ids that are valid IDREFs.

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
