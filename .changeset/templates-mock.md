---
"@zengin/registry": patch
---

The review and chat templates run on `zengin mock` rows: `mock.json` in each declares the queue's reviews (author, status, submitted) and the sidebar's threads (when, turns); `src/data.ts` pairs the rows with a catalog of prose, since a sentence from a word pool is not a review title. Both ship the schema and get a `mock` script when created.
