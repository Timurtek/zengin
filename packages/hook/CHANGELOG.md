# @zenginui/hook

## 0.2.1

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
- Updated dependencies [[`4d14470`](https://github.com/Timurtek/zengin/commit/4d14470b9869a6ef64a5e352296b8fb94cc1d724)]:
  - @zenginui/engine@0.5.0

## 0.2.0

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

## 0.1.3

### Patch Changes

- Updated dependencies [[`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/engine@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/engine@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb)]:
  - @zenginui/engine@0.2.0

## 0.1.0

### Minor Changes

- [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc) Thanks [@Timurtek](https://github.com/Timurtek)! - First public release of the Zengin conformance layer.
  
  - `@zenginui/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
  - `@zenginui/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
  - `@zenginui/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
  - `@zenginui/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
