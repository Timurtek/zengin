---
"@zenginui/registry": patch
---

A created project pins the versions it was created from, and its Storybook is whole.

Two faults found the way the last batch was found: by scaffolding a project from the published packages
and using it, rather than from the checkout.

- **`create` pinned `@zenginui/cli`, `@zenginui/hook` and `@zenginui/mcp` at `^0.1.0`.** One hand-written
  constant covered all three, so a project created after four releases still installed the first one:
  `zengin define`, `profiles:` and `add --install` were all documented, all released, and all missing from
  the project someone was handed. `npx zengin add card --install` inside a fresh project answered
  `Unknown option --install`. The versions are now generated from the workspace at build time, which runs
  after Changesets has set them, so a project pins what was published alongside it. A test reads the same
  package.json files rather than repeating the numbers, because a constant in a test goes stale exactly
  when the constant in the source does.

- **A template now includes the components its own stories demonstrate.** `add` deliberately withholds a
  story whose requirements are not met, which is right when someone asked for one component and should not
  receive three. A template is the other case: it is a whole project, and its Storybook is that project's
  documentation of the system it owns, so a scaffold whose first output was "1 story was left out" reported
  a hole the person did not make. Across the eight templates this adds two components in total, Badge to
  blank and Checkbox to saas.
