# Changesets

Every change that a consumer of a package should know about gets a changeset: a small markdown file in this directory naming the packages it affects, the semver bump each needs, and a one-paragraph summary written for the changelog.

```bash
pnpm changeset            # interactive; or write the file by hand, see below
```

A changeset file looks like this:

```md
---
"@zenginui/engine": minor
"@zenginui/cli": patch
---

Short summary of what changed and why a consumer cares.
```

On merge to `main`, the release workflow collects pending changesets into a "Version Packages" pull request that bumps versions, updates changelogs and removes the consumed changeset files. Merging that PR publishes to npm.

Changes with no consumer-visible effect (tests, docs, CI) need no changeset.
