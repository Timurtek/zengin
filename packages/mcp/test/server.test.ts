import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHost, findConfig } from "../src/host.js";
import { createServer } from "../src/server.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureProject = join(here, "..", "..", "engine", "test", "fixtures", "project");
const configPath = join(fixtureProject, "zengin.config.yaml");

let client: Client;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const host = createHost(configPath);
  const server = createServer(host);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  cleanup = async () => {
    await client.close();
    await server.close();
  };
});

afterAll(async () => cleanup());

type Structured = Record<string, any>;

async function call(name: string, args: Record<string, unknown>): Promise<{ text: string; data: Structured; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text?: string }[];
  return {
    text: content.map((c) => c.text ?? "").join("\n"),
    data: (result.structuredContent ?? {}) as Structured,
    isError: result.isError === true,
  };
}

describe("tool listing", () => {
  it("exposes the four tools with read-only annotations", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "zengin_check_code",
      "zengin_describe_system",
      "zengin_explain_rules",
      "zengin_get_violations",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
});

describe("zengin_check_code", () => {
  it("returns the ApproveBar violations for code that is not on disk", async () => {
    const content = readFileSync(join(fixtureProject, "src/features/review/ApproveBar.tsx"), "utf8");
    const { data, text, isError } = await call("zengin_check_code", { path: "src/features/review/ApproveBar.tsx", content });
    expect(isError).toBe(false);
    expect(data.kind).toBe("consumer");
    expect(data.total).toBe(4);
    expect(data.violations[0]).toMatchObject({
      rule: "color-literal",
      found: "bg-[#3B82F6]",
      fix: { replace: "bg-primary", confidence: "exact", token: "color.primary" },
    });
    expect(text).toContain("## src/features/review/ApproveBar.tsx");
    expect(text).toContain("fix (exact): bg-primary");
  });

  it("applies scope to the path the agent supplies", async () => {
    const owned = await call("zengin_check_code", {
      path: "src/components/ui/anything.tsx",
      content: `export const X = () => <button className="rounded-md bg-[#EEEEEE] px-4">x</button>;`,
    });
    expect(owned.data.kind).toBe("owned");
    expect(owned.data.violations.map((v: any) => v.rule)).toEqual(["color-literal"]);

    const excluded = await call("zengin_check_code", { path: "src/Foo.stories.tsx", content: `const a = "bg-[#fff]";` });
    expect(excluded.data.kind).toBe("excluded");
    expect(excluded.data.total).toBe(0);
    expect(excluded.text).toMatch(/Nothing was checked/);
  });

  it("accepts absolute paths and normalises them", async () => {
    const { data } = await call("zengin_check_code", {
      path: join(fixtureProject, "src", "features", "x.tsx"),
      content: `export const X = () => <div className="p-[13px]" />;`,
    });
    expect(data.path).toBe("src/features/x.tsx");
    expect(data.total).toBe(1);
  });

  it("returns a JSON rendering on request", async () => {
    const { text } = await call("zengin_check_code", { path: "src/a.tsx", content: `const a = 1;`, format: "json" });
    expect(JSON.parse(text)).toMatchObject({ path: "src/a.tsx", total: 0 });
  });
});

describe("zengin_get_violations", () => {
  it("checks the whole project scope and matches the engine snapshot count", async () => {
    const { data } = await call("zengin_get_violations", {});
    const expected = JSON.parse(readFileSync(join(fixtureProject, "..", "expected", "violations.json"), "utf8"));
    expect(data.total).toBe(expected.length);
    expect(data.returned).toBe(expected.length);
    expect(data.truncated).toBe(false);
    expect(data.system).toEqual({ package: "@zengin/ui", version: "1.2.0" });
    expect(data.summary.byRule["color-literal"]).toBeGreaterThan(0);
  });

  it("filters by path, rule and severity, and truncates by limit", async () => {
    const byPath = await call("zengin_get_violations", { paths: ["src/features/review/RejectButton.tsx"] });
    expect(byPath.data.filesChecked).toBe(1);
    expect(Object.keys(byPath.data.summary.byFile)).toEqual(["src/features/review/RejectButton.tsx"]);

    const byRule = await call("zengin_get_violations", { rules: ["unknown-prop-value"] });
    expect(byRule.data.violations.every((v: any) => v.rule === "unknown-prop-value")).toBe(true);
    expect(byRule.data.total).toBe(2);

    const limited = await call("zengin_get_violations", { limit: 3 });
    expect(limited.data.returned).toBe(3);
    expect(limited.data.truncated).toBe(true);
    expect(limited.data.total).toBeGreaterThan(3);
  });

  it("reports a missing file as an error, not a crash", async () => {
    const { isError, text } = await call("zengin_get_violations", { paths: ["src/does-not-exist.tsx"] });
    expect(isError).toBe(true);
    expect(text).toMatch(/File not found: src\/does-not-exist\.tsx/);
  });
});

describe("zengin_describe_system", () => {
  it("returns one component's contract", async () => {
    const { data, text } = await call("zengin_describe_system", { component: "Button" });
    expect(data.components).toHaveLength(1);
    expect(data.components[0].props.variant.values).toEqual(["solid", "soft", "ghost", "link"]);
    expect(data.tokens).toEqual([]);
    expect(text).toContain("prop variant: enum = solid | soft | ghost | link");
    expect(text).toContain("className may set: margin, width, flex-item, grid-item, position");
  });

  it("returns tokens by namespace", async () => {
    const { data } = await call("zengin_describe_system", { namespace: "spacing" });
    expect(data.tokens.every((t: any) => t.namespace === "spacing")).toBe(true);
    expect(data.tokens.find((t: any) => t.name === "space.3")).toMatchObject({ cssVar: "--spacing-3", value: "12px" });
  });

  it("names the available components when one is unknown", async () => {
    const { isError, text } = await call("zengin_describe_system", { component: "Butt" });
    expect(isError).toBe(true);
    expect(text).toMatch(/Components: Button, Dialog/);
  });
});

describe("zengin_explain_rules", () => {
  it("reflects the project's configuration", async () => {
    const { data } = await call("zengin_explain_rules", {});
    expect(data.rules).toHaveLength(7);
    const color = data.rules.find((r: any) => r.id === "color-literal");
    expect(color).toMatchObject({ family: "foundation", enabled: true, severity: "error", allow: "semantic" });
    expect(color.except).toEqual(["src/marketing/illustrations/**"]);
    expect(data.scope.ownership).toEqual(["src/components/ui/**"]);
  });
});

describe("config discovery", () => {
  it("walks up from a nested directory", () => {
    expect(findConfig(undefined, join(fixtureProject, "src", "features"))).toBe(configPath);
  });

  it("explains what to do when nothing is found", () => {
    expect(() => findConfig(undefined, "/")).toThrow(/Pass --config/);
  });
});
