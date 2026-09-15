---
"@zenginui/hook": minor
"@zenginui/registry": minor
"@zenginui/cli": minor
"@zenginui/ui": patch
---

The enforcement loop is as wide as the ways an agent edits a file, and `doctor` says what it looked at.

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

- **Combobox's doc comment is attached to Combobox again.** The fix for #8 inserted a helper between the
  component's JSDoc and the component, so the exported component had none. A no-op filter is gone too.
