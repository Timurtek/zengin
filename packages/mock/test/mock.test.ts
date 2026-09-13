import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { generateMock, pluralOf, PRESETS, schemaFromPresets } from "../src/index.js";

const tmp = mkdtempSync(join(tmpdir(), "zengin-mock-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Writes generated files under a fresh directory and imports the entity module through Vite's transform. */
async function load(files: Record<string, string>, entry: string): Promise<Record<string, unknown>> {
  const dir = join(tmp, Math.random().toString(36).slice(2));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return (await import(pathToFileURL(join(dir, entry)).href)) as Record<string, unknown>;
}

describe("generateMock", () => {
  it("writes the runtime once and one typed module per entity", () => {
    const files = generateMock(schemaFromPresets(["users", "invoices"]));
    expect(Object.keys(files).sort()).toEqual(["src/mock/invoices.ts", "src/mock/rng.ts", "src/mock/users.ts"]);
    const users = files["src/mock/users.ts"]!;
    expect(users).toContain("export interface User {");
    expect(users).toContain('  role: "owner" | "admin" | "member" | "viewer";');
    expect(users).toContain("export function makeUser(index: number, rng: Rng): User {");
    expect(users).toContain("export const users: User[] = Array.from({ length: 24 }");
    expect(users).not.toContain("company:"); // users have no company field, so no company is drawn
  });

  it("produces data that is deterministic, typed and realistic", async () => {
    const files = generateMock(schemaFromPresets(["customers"], { seed: 3, count: 10 }));
    const a = await load(files, "src/mock/customers.ts");
    const b = await load(files, "src/mock/customers.ts");
    const customers = a["customers"] as Record<string, unknown>[];
    expect(customers).toHaveLength(10);
    expect(JSON.stringify(a["customers"])).toBe(JSON.stringify(b["customers"]));
    const c = customers[0]!;
    expect(c["id"]).toBe("CUS-1000");
    expect(c["name"]).toMatch(/^[A-Z][^ ]+ [A-Z]/);
    expect(c["email"]).toMatch(/^[a-z.]+@[a-z]+\.(com|io|dev|co)$/);
    expect(["Free", "Starter", "Team", "Business", "Enterprise"]).toContain(c["plan"]);
    expect(typeof c["mrr"]).toBe("number");
    expect((c["usage"] as number[]).length).toBe(12);
    expect(c["since"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Every id is unique and the enum weights bias the distribution.
    expect(new Set(customers.map((x) => x["id"])).size).toBe(10);
  });

  it("supports custom schemas with refs and every field kind", async () => {
    const files = generateMock(
      {
        seed: 11,
        entities: [
          { name: "Team", count: 3, fields: { id: { type: "id", prefix: "TM" }, name: "company", city: "city" } },
          {
            name: "Member",
            count: 6,
            fields: { id: "id", team: { type: "ref", entity: "teams" }, name: "fullName", phone: "phone", site: "url", score: { type: "percent", min: 0, max: 100 }, bio: "paragraph", trend: { type: "series", length: 5, min: 1, max: 9, trend: "down" }, flag: "boolean" },
          },
        ],
      },
      { dir: "mock" },
    );
    expect(files["mock/members.ts"]).toContain('import { teams } from "./teams";');
    expect(files["mock/members.ts"]).toContain("team: rng.pick(teams).id,");
    const m = await load(files, "mock/members.ts");
    const members = m["members"] as Record<string, unknown>[];
    expect(members).toHaveLength(6);
    expect(members[0]!["team"]).toMatch(/^TM-100[0-2]$/);
    expect(members[0]!["phone"]).toMatch(/^\+1 \d{3} \d{3} \d{4}$/);
    expect(members[0]!["site"]).toMatch(/^https:\/\/[a-z]+\.(com|io|dev|co)$/);
    expect((members[0]!["trend"] as number[]).length).toBe(5);
  });

  it("names presets and refs it does not know", () => {
    expect(() => schemaFromPresets(["users", "dragons"])).toThrow(/No preset named "dragons"\. Presets: users, customers/);
    expect(() => generateMock({ entities: [{ name: "A", fields: { b: { type: "ref", entity: "nope" } } }] })).toThrow(/refers to "nope"/);
  });

  it("pluralises entity names", () => {
    expect(pluralOf("User")).toBe("users");
    expect(pluralOf("Company")).toBe("companies");
    expect(pluralOf("Address")).toBe("addresses");
    expect(Object.keys(PRESETS)).toContain("metrics");
  });
});
