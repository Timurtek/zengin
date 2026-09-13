---
"@zenginui/mock": patch
"@zenginui/registry": minor
---

The SaaS template runs on `zengin mock` data: `mock.json` in the template declares customers, invoices, events, signups and a daily metric, `src/mock` holds the generated rows, and `src/data.ts` derives MRR, signups by month and relative times on top. A template that ships `mock.json` gives the created project a `mock` script (`zengin mock --schema mock.json`). Generated modules import only the runtime helpers they use.
