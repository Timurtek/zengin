# @zengin/mock

Mock data to see a screen with, before there is a backend. Typed, seeded, realistic, and generated as plain TypeScript into the project, so it has no runtime dependency and the same data shows up on every run and in every screenshot.

```bash
zengin mock customers invoices            # presets into src/mock/, one module each
zengin mock users --count 50 --seed 3     # more of them, a different draw
zengin mock --schema mock.json            # your own entities
```

```ts
import { customers } from "@/mock/customers";
customers[0]; // { id: "CUS-1000", name: "Ada Okafor", company: "Northwind", plan: "Team", mrr: 396, status: "active", usage: [...], ... }
```

## Presets

`users`, `customers`, `companies`, `products`, `orders`, `invoices`, `events`, `messages`, `metrics`. Each is a schema with the fields an app shows for that thing; the generated module exports the type, a `make<Name>(index, rng)` factory, and the array.

## Schemas

```json
{
  "seed": 11,
  "entities": [
    { "name": "Team", "count": 4, "fields": { "id": { "type": "id", "prefix": "TM" }, "name": "company", "city": "city" } },
    { "name": "Member", "count": 20, "fields": {
      "id": "id",
      "team": { "type": "ref", "entity": "teams" },
      "name": "fullName", "email": "email", "title": "jobTitle",
      "role": { "type": "enum", "values": ["admin", "member"], "weights": [1, 5] },
      "active": { "type": "boolean", "p": 0.9 },
      "joined": { "type": "date", "pastDays": 400 },
      "usage": { "type": "series", "length": 12, "min": 10, "max": 90, "trend": "up" }
    } }
  ]
}
```

Field kinds: `id`, `firstName`, `lastName`, `fullName`, `email`, `company`, `jobTitle`, `city`, `country`, `sentence`, `paragraph`, `words`, `url`, `phone`, `boolean`, `date`, `money`, `int`, `float`, `percent`, `enum`, `series`, `ref`. A bare name takes the defaults; an object takes options. `ref` gives the id of a row from another entity in the same schema, which imports it.

## How it is generated

`src/mock/rng.ts` is the runtime: a mulberry32 generator, pick with weights, dates against a fixed "now" so nothing drifts, series with a trend, and the pools (names, companies, cities, words). Every entity module is a factory plus `Array.from` over a seed, so `count` and `seed` change the draw and nothing else. Edit the pools to make the data yours.

## Programmatic use

```ts
import { generateMock, schemaFromPresets } from "@zengin/mock";
const files = generateMock(schemaFromPresets(["customers"], { count: 30 }));
// { "src/mock/rng.ts": "...", "src/mock/customers.ts": "..." }
```
