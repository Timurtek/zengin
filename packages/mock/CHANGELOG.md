# @zenginui/mock

## 0.1.0

### Minor Changes

- [`cf35643`](https://github.com/Timurtek/zengin/commit/cf35643dade7f24efe20a68eb867faa58331f0d0) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/mock` and `zengin mock`: typed, seeded mock data generated as plain TypeScript into `src/mock`, from presets (users, customers, companies, products, orders, invoices, events, messages, metrics) or a schema of your own.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- [`4924af2`](https://github.com/Timurtek/zengin/commit/4924af241d9408768d67938d142340874d151bb3) Thanks [@Timurtek](https://github.com/Timurtek)! - The SaaS template runs on `zengin mock` data: `mock.json` in the template declares customers, invoices, events, signups and a daily metric, `src/mock` holds the generated rows, and `src/data.ts` derives MRR, signups by month and relative times on top. A template that ships `mock.json` gives the created project a `mock` script (`zengin mock --schema mock.json`). Generated modules import only the runtime helpers they use.
