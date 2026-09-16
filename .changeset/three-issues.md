---
"@zenginui/engine": minor
"@zenginui/hook": patch
"@zenginui/cli": patch
"@zenginui/ui": patch
"@zenginui/adapter-css": minor
---

One definition of the agent wiring, a `--fix` that does what it prints, and a manifest that records who owns what.

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
