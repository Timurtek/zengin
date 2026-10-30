# marketing-site

Zengin's own marketing page, built on `@zenginui/ui` and checked by the engine it advertises. It is the marketing treatment from the product vision, next to the [review workspace](../review-workspace): the same components and tokens, a different brand.

```bash
pnpm build                                  # from the repository root, once
pnpm --filter marketing-site dev            # http://localhost:5174
pnpm --filter marketing-site check          # zengin check: 0 violations, 0 suppressions
pnpm --filter marketing-site screenshot     # demo/light.png, demo/dark.png, demo/hero-fixed.png in a real Chromium
pnpm --filter marketing-site previews       # build every template's app into public/templates/ and Storybook into public/storybook/
node demo/sample/run.mjs                    # regenerate the hero panel's violations from the engine
```

## How the brand works

`src/theme/brand.css` is the whole brand, and it is the `zengin` theme in the registry: ivory (#F4F1E9) and ink (#20231F), vermilion (#D7472F, a shade under it on buttons so white text reaches AA) as the single accent, olive (#727B60) as the success tone for what is on-system, Inter Tight for headlines and Inter for text, the system's own JetBrains Mono for labels. Both color schemes. The earlier spec-sheet brand lives on as the `spec-sheet` theme. It redefines tokens the system already has and nothing else, so every component from `@zenginui/ui` wears it without a line of component CSS changing. It is the only file allowed to hold literals (`scope.foundations` in `zengin.config.yaml`).

`src/site.css` is layout and typography for the page. Every value is a token, including the drafting grid behind the hero, which is `color-mix()`ed from the border token. Zero violations, zero suppressions. The hero band runs in the opposite theme to the page by attaching `data-theme` to one element, which is how Zengin UI themes work everywhere.

## What the page shows

- **Hero.** The band in the opposite theme, the headline, a spec strip of four facts, and the check panel: a file an agent might write, the engine's findings for it, and the file after the fixes. `demo/sample/Actions.tsx` is the file, `demo/sample/run.mjs` runs the engine on it and writes `src/data/sample.json`, and it asserts that `Actions.fixed.tsx` is clean. The findings are engine output, not copy.
- **Templates.** Live previews, not screenshots. `scripts/build-previews.mjs` builds every template's source app (named by the registry's `source` field) into `public/templates/<name>/` with a matching base path, so the catalog embeds each one in a scaled iframe you can use, with an open-full-page link and the `create` command. The theme tabs pass `?theme=<name>` to every preview; a small harness in each example app (`src/preview-theme.ts`, stripped from templates by the registry builder) fetches that brand file from `/r` and applies it live. Inside a preview the catalog shows placeholders, so the marketing template does not embed itself forever.
- **Surfaces.** The four surfaces in a `Tabs` component, each with a real config or output.
- **Rules.** The seven rule kinds from `packages/engine/src/docs.ts`.
- **Reference system.** Zengin UI components in this brand, the same card under both themes side by side (`data-theme` attaches to any element), and a link to Storybook, which the site build compiles from `packages/ui` into `public/storybook/` so it deploys with the page at `/storybook/`.
- **Field tests.** The numbers from `docs/field-tests`.

## What the page added to the system

Building it is what decided the next components and tokens, as the vision asks: `Tabs` (line and pill variants, two sizes, manifest, story, tests), a `font.display` token, `text.4xl` to `text.6xl`, `space.20` to `space.32`, and `leading.none`.

## Deploying to Vercel

The site is a static Vite build; `vercel.json` pins the rest. In the Vercel project, set **Root Directory** to `examples/marketing-site` and turn on **Include source files outside of the Root Directory**, so the workspace packages are available. The build command builds the dependency chain first (`pnpm --filter marketing-site... build`: engine, then ui, then the site) and then runs `zengin check`, so a deploy fails if the page drifts from its own system, the same gate CI applies.

Set **`VITE_POSTHOG_KEY`** (the PostHog project API key) in the Vercel project for the production deploy to send analytics; without it the site sends nothing. Events, the one number and the privacy settings are in [docs/analytics.md](../../docs/analytics.md).

## Errors

The site and the docs report their errors to PostHog's error tracking, through `packages/site-errors`: an error nothing caught, a promise nobody handled, and an error the page caught and passed to the standard `reportError()` (the catalog does, when the registry does not answer). Each is tagged with `release` (Vercel's `VERCEL_GIT_COMMIT_SHA`, `local` elsewhere) and `surface` (`site` or `docs`). Only errors are sent: no pageviews, no autocapture, no recordings, no cookie or storage, and Do Not Track is honoured.

Set **`VITE_POSTHOG_KEY`** (the project API key) in the Vercel project, for Production and Preview; `VITE_POSTHOG_HOST` only if the project is not on PostHog's US cloud. Without the key nothing is loaded and nothing is sent. In the PostHog project, turn on **Discard client IP data** and leave **exception autocapture** off, since the site reports every error itself.

When an error takes a page down, the page is replaced by a screen that says so and offers Reload and a way back to the start; an address with no page gets `404.html`, which links to the home page and the docs.

All of it is added from outside `src/`: `vite.config.ts` puts `site/errors.ts` on every page. `src/` is also the marketing template, and the projects made from it must not report to Zengin; a registry test fails if a template mentions `site-errors` or PostHog.

## Wired in

| File | Surface |
| --- | --- |
| `zengin.config.yaml` | System, scope with `src/theme/**` as foundations, every rule at `error`. |
| `.mcp.json` | The MCP server for agents working in this directory. |
| `.claude/settings.json` | The PostToolUse hook, on every `Write` and `Edit`. |
| `package.json` `test` | `zengin check`, so CI fails if the page drifts from its own system; then the analytics unit tests and `scripts/check-measure.mjs`, which proves the events in the built pages. |
