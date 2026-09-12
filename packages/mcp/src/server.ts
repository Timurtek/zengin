import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FAMILY_NOTES, RULE_DOCS, RULE_IDS, type RuleId, type Violation } from "@zengin/engine";
import { renderSummary, renderViolations, summarize } from "@zengin/engine";
import type { Host } from "./host.js";

export const SERVER_NAME = "zengin-mcp-server";
export const SERVER_VERSION = "0.0.1";

const MAX_VIOLATIONS = 500;

const RuleIdSchema = z.enum(RULE_IDS as unknown as [RuleId, ...RuleId[]]);
const SeveritySchema = z.enum(["error", "warn", "info"]);
const FormatSchema = z.enum(["markdown", "json"]).default("markdown").describe("Text rendering: 'markdown' for a compact per-file list, 'json' for the raw violation array. structuredContent always carries the JSON.");

const PosSchema = z.object({ line: z.number().int(), col: z.number().int() });
const ViolationSchema = z.object({
  rule: RuleIdSchema,
  severity: SeveritySchema,
  file: z.string(),
  range: z.object({ start: PosSchema, end: PosSchema }),
  found: z.string(),
  message: z.string(),
  fix: z.object({
    replace: z.string().nullable(),
    confidence: z.enum(["exact", "nearest", "none"]),
    token: z.string().optional(),
    candidates: z.array(z.string()).optional(),
    note: z.string().optional(),
  }),
  suppress: z.string(),
  note: z.string().optional(),
});

export function createServer(host: Host): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  const respond = (text: string, structured: Record<string, unknown>) => ({
    content: [{ type: "text" as const, text }],
    structuredContent: structured,
  });

  const fail = (error: unknown) => ({
    content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });

  server.registerTool(
    "zengin_check_code",
    {
      title: "Check code against the design system",
      description: `Check a piece of code against the design system's rules before or after writing it. Returns structured violations with suggested corrections. Deterministic: the same input always yields the same violations.

Use this mid-generation, on the code you are about to write or have just written, so you can self-correct before it lands. The code is not read from or written to disk.

Args:
  - path (string): Project-relative path the code lives at or will live at, e.g. "src/features/review/ApproveBar.tsx". Required because it decides the parser (.tsx/.jsx/.ts/.js or .css) and which scope applies: files under scope.ownership relax contract and substitution rules; files under scope.foundations are not checked; files outside scope.include are excluded.
  - content (string): The full source of the file.
  - format ('markdown' | 'json'): Text rendering (default: 'markdown').

Returns:
  { path, kind: 'consumer' | 'owned' | 'foundation' | 'excluded', total, violations: Violation[] }
  Each violation: { rule, severity, file, range: {start:{line,col}, end:{line,col}}, found, message, fix: { replace: string | null, confidence: 'exact' | 'nearest' | 'none', token?, candidates?, note? }, suppress, note? }
  fix.replace is a code edit for exactly the text in range. 'exact' fixes are safe to apply as-is; 'nearest' fixes need a judgement call (read fix.note); 'none' means the engine knows what is wrong but not what is right.

Examples:
  - Use when: you generated a component and want to know whether it obeys the system before reporting done.
  - Use when: a user asks "is this on-system?" about a snippet.
  - Don't use when: you want to check files already on disk (use zengin_get_violations).`,
      inputSchema: {
        path: z.string().min(1).describe('Project-relative path, e.g. "src/features/Foo.tsx". Decides parser and scope.'),
        content: z.string().describe("Full file source to check."),
        format: FormatSchema,
      },
      outputSchema: {
        path: z.string(),
        kind: z.enum(["consumer", "owned", "foundation", "excluded"]),
        total: z.number().int(),
        violations: z.array(ViolationSchema),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ path, content, format }) => {
      try {
        const engine = await host.engine();
        const rel = host.relativize(path);
        const file = { path: rel, content };
        const kind = engine.kindOf(file);
        const violations = engine.checkFile(file);
        const output = { path: rel, kind, total: violations.length, violations };
        const heading =
          kind === "excluded"
            ? `${rel} is outside scope.include or matches scope.exclude. Nothing was checked.`
            : kind === "foundation"
              ? `${rel} is a foundation file. Literals are expected here and nothing was checked.`
              : `${rel} (${kind}): ${renderSummary(summarize(violations))}`;
        const text = format === "json" ? JSON.stringify(output, null, 2) : renderViolations(violations, heading);
        return respond(text, output);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "zengin_get_violations",
    {
      title: "Get violations in project files",
      description: `Check files on disk against the design system and return their violations. Checks the whole project scope when no paths are given.

Args:
  - paths (string[], optional): Project-relative or absolute paths to check. Omit to check every file matched by scope.include minus scope.exclude.
  - rules (rule id[], optional): Only report these rules. One of: ${RULE_IDS.join(", ")}.
  - severity ('error' | 'warn' | 'info', optional): Only report this severity.
  - limit (number): Maximum violations to return, 1-${MAX_VIOLATIONS} (default: 200). The summary always covers all matches.
  - format ('markdown' | 'json'): Text rendering (default: 'markdown').

Returns:
  { projectDir, system: { package, version }, filesChecked, total, returned, truncated, summary: { bySeverity, byRule, byFile }, violations: Violation[] }
  Violation shape is the same as zengin_check_code.

Examples:
  - Use when: "What is off-system in src/features/review?" -> paths: ["src/features/review/ApproveBar.tsx", ...]
  - Use when: "How much drift does this repo have?" -> no paths, read summary.byRule and summary.byFile.
  - Don't use when: checking code that is not on disk yet (use zengin_check_code).`,
      inputSchema: {
        paths: z.array(z.string().min(1)).optional().describe("Files to check. Omit for the whole project scope."),
        rules: z.array(RuleIdSchema).optional().describe("Only these rule ids."),
        severity: SeveritySchema.optional().describe("Only this severity."),
        limit: z.number().int().min(1).max(MAX_VIOLATIONS).default(200).describe("Max violations returned."),
        format: FormatSchema,
      },
      outputSchema: {
        projectDir: z.string(),
        system: z.object({ package: z.string(), version: z.string() }),
        filesChecked: z.number().int(),
        total: z.number().int(),
        returned: z.number().int(),
        truncated: z.boolean(),
        summary: z.object({
          total: z.number().int(),
          bySeverity: z.object({ error: z.number().int(), warn: z.number().int(), info: z.number().int() }),
          byRule: z.record(z.string(), z.number().int()),
          byFile: z.record(z.string(), z.number().int()),
        }),
        violations: z.array(ViolationSchema),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ paths, rules, severity, limit, format }) => {
      try {
        const engine = await host.engine();
        const files = host.readFiles(paths);
        let violations: Violation[] = engine.check(files);
        if (rules) violations = violations.filter((v) => rules.includes(v.rule));
        if (severity) violations = violations.filter((v) => v.severity === severity);
        const summary = summarize(violations);
        const returned = violations.slice(0, limit);
        const output = {
          projectDir: host.projectDir,
          system: { package: host.config.system.package, version: host.config.system.version },
          filesChecked: files.length,
          total: violations.length,
          returned: returned.length,
          truncated: returned.length < violations.length,
          summary,
          violations: returned,
        };
        const heading = `${files.length} file${files.length === 1 ? "" : "s"} checked against ${output.system.package}@${output.system.version}: ${renderSummary(summary)}${output.truncated ? ` (showing first ${returned.length})` : ""}`;
        const text = format === "json" ? JSON.stringify(output, null, 2) : renderViolations(returned, heading);
        return respond(text, output);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "zengin_describe_system",
    {
      title: "Describe the design system",
      description: `Return the design system's tokens and component contracts, so generated code can reference what actually exists. This is the same definition the rules check against.

Args:
  - component (string, optional): Return only this component's manifest (case-sensitive name, e.g. "Button").
  - namespace (string, optional): Return only tokens in this namespace, e.g. "color", "spacing", "radius", "shadow", "text".
  - format ('markdown' | 'json'): Text rendering (default: 'markdown').

Returns:
  { package, version, sources, tokens: [{ name, cssVar, namespace, type, value }], components: [{ name, since, export, replaces, extends, props, className: { allow }, owns, slots, states }] }
  In Tailwind, a token with cssVar --color-primary is used as bg-primary / text-primary / border-primary; --spacing-3 as p-3 / gap-3 / mt-3; --radius-md as rounded-md.
  A component's className.allow lists the only CSS property groups a consumer may set through className; owns maps each owned CSS property to the prop that controls it.

Examples:
  - Use when: you need to know which Button variants exist before writing <Button variant=...>.
  - Use when: you need the semantic color token for a surface, border or text role.`,
      inputSchema: {
        component: z.string().optional().describe("Only this component."),
        namespace: z.string().optional().describe("Only tokens in this namespace."),
        format: FormatSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ component, namespace, format }) => {
      try {
        const engine = await host.engine();
        const tokens = engine.definitions.tokens
          .filter((t) => !namespace || t.namespace === namespace)
          .map(({ name, cssVar, namespace: ns, type, value }) => ({ name, cssVar, namespace: ns, type, value }));
        const components = engine.definitions.components.filter((c) => !component || c.name === component);
        if (component && components.length === 0) {
          const names = engine.definitions.components.map((c) => c.name).join(", ");
          return fail(new Error(`No component named "${component}". Components: ${names}.`));
        }
        const output = {
          package: host.config.system.package,
          version: host.config.system.version,
          sources: host.config.system.sources,
          tokens: component ? [] : tokens,
          components: namespace && !component ? [] : components,
        };
        let text: string;
        if (format === "json") {
          text = JSON.stringify(output, null, 2);
        } else {
          const lines = [`# ${output.package}@${output.version}`, ""];
          if (output.tokens.length) {
            lines.push("## Tokens", "");
            for (const t of output.tokens) lines.push(`- ${t.name} (${t.cssVar}) = ${t.value}`);
            lines.push("");
          }
          for (const c of output.components) {
            lines.push(`## ${c.name}`, "", `import { ${c.export.name} } from "${c.export.from}"`, "");
            if (c.replaces?.length) lines.push(`- replaces: ${c.replaces.join(", ")}`);
            for (const [name, p] of Object.entries(c.props ?? {})) {
              const values = p.values ? ` = ${p.values.join(" | ")}` : "";
              const def = p.default !== undefined ? ` (default ${JSON.stringify(p.default)})` : "";
              const since = p.since ? ` since ${p.since}` : "";
              lines.push(`- prop ${name}: ${p.type}${values}${def}${since}`);
              if (p.valuesSince) lines.push(`  value availability: ${Object.entries(p.valuesSince).map(([v, s]) => `${v} since ${s}`).join(", ")}`);
            }
            if (c.className?.allow) lines.push(`- className may set: ${c.className.allow.join(", ") || "nothing"}`);
            if (c.owns) lines.push(`- owns: ${Object.entries(c.owns).map(([k, v]) => `${k}${v ? ` (via ${v})` : ""}`).join(", ")}`);
            if (c.slots?.length) lines.push(`- slots: ${c.slots.join(", ")}`);
            if (c.states?.length) lines.push(`- states: ${c.states.join(", ")}`);
            lines.push("");
          }
          text = lines.join("\n");
        }
        return respond(text, output);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "zengin_explain_rules",
    {
      title: "Explain the rules and their configuration",
      description: `Return what each rule checks, whether it is enabled in this project, its severity, and how to suppress or scope it.

Args:
  - rule (rule id, optional): Only this rule. One of: ${RULE_IDS.join(", ")}.

Returns:
  { rules: [{ id, family, enabled, severity, allow?, except, description }], scope: { include, exclude, foundations, ownership }, notes }`,
      inputSchema: { rule: RuleIdSchema.optional().describe("Only this rule.") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ rule }) => {
      const rules = RULE_IDS.filter((id) => !rule || id === rule).map((id) => {
        const cfg = host.config.rules[id];
        return {
          id,
          family: RULE_DOCS[id].family,
          enabled: cfg.enabled,
          severity: cfg.severity,
          ...(id === "color-literal" ? { allow: cfg.allow } : {}),
          except: cfg.except,
          description: RULE_DOCS[id].description,
        };
      });
      const output = { rules, scope: host.config.scope, notes: FAMILY_NOTES };
      const lines = ["# Zengin rules", ""];
      for (const r of rules) {
        lines.push(`## ${r.id} (${r.family}, ${r.enabled ? r.severity : "off"}${"allow" in r ? `, allow: ${r.allow}` : ""})`, "", r.description);
        if (r.except.length) lines.push(`Off under: ${r.except.join(", ")}`);
        lines.push("");
      }
      lines.push(FAMILY_NOTES);
      return respond(lines.join("\n"), output);
    },
  );

  return server;
}
