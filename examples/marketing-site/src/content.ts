/** Everything the page says. Numbers and quotes come from the repository's own docs, named beside each. */

export const REPO = "https://github.com/Timurtek/zengin";

export const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: "#how", label: "How it works" },
  { href: "#templates", label: "Templates" },
  { href: "/storybook/index.html", label: "Storybook", external: true },
  { href: "/rollup/index.html", label: "Rollup", external: true },
  { href: "#surfaces", label: "Surfaces" },
  { href: "#rules", label: "Rules" },
  { href: "#system", label: "Reference system" },
  { href: "#proof", label: "Field tests" },
];

export const STEPS = [
  {
    title: "Definitions your system already has",
    body: "tokens.json in the W3C design-token format and components.json, the manifest of props, values, owned properties and what each component replaces. Write them by hand, or derive them with zengin init: from a shadcn project, or from any installed design-system package, its CSS variables and its type declarations.",
  },
  {
    title: "A deterministic engine",
    body: "Parses TSX and CSS, resolves class names through your own stylesheets (and Tailwind, if you use it), and runs seven rule kinds. Every violation carries the fix and how sure the engine is of it: exact, nearest, or none. No model in the loop, so the same input always gives the same answer.",
  },
  {
    title: "Wherever the agent works",
    body: "The MCP server for tools it can call, a hook that runs after every edit, a CLI for the terminal and CI, and a rollup across every repository that consumes the system. One engine, four surfaces, the same violations in each.",
  },
];

export type Surface = { id: string; label: string; title: string; body: string; points: string[]; code: { title: string; text: string } };

export const SURFACES: Surface[] = [
  {
    id: "mcp",
    label: "MCP server",
    title: "Tools the agent calls before and after it writes",
    body: "Four tools over stdio. The agent describes the system before it starts, checks a snippet before it commits to it, and reads the rules in the words every surface uses.",
    points: [
      "zengin_check_code: violations and fixes for a snippet, without touching disk",
      "zengin_get_violations: the files in scope, or only the ones that changed",
      "zengin_describe_system: tokens and component contracts, so the agent can plan",
      "zengin_explain_rules: what each rule kind means and how to suppress one",
    ],
    code: {
      title: ".mcp.json",
      text: `{
  "mcpServers": {
    "zengin": {
      "command": "zengin-mcp",
      "env": { "ZENGIN_CONFIG": "zengin.config.yaml" }
    }
  }
}`,
    },
  },
  {
    id: "hook",
    label: "Hook",
    title: "Runs after every edit the agent makes",
    body: "A PostToolUse hook for Claude Code. When the edited lines carry a violation with a fix, the edit is blocked and the fix goes back to the agent. Lines the agent did not touch are not its problem.",
    points: [
      "Exit 2 blocks; the violations, fixes and confidence go back as the reason",
      "--scope changed reports only the lines that were just written",
      "--block-on chooses which severities block and which only inform",
      "Any file the engine parses: TSX, TS, CSS",
    ],
    code: {
      title: ".claude/settings.json",
      text: `{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{ "type": "command", "command": "zengin-hook", "timeout": 30 }]
    }]
  }
}`,
    },
  },
  {
    id: "cli",
    label: "CLI and CI",
    title: "The same engine in a terminal and in CI",
    body: "Check a tree, a directory, or only what changed since a ref. The GitHub format annotates the exact lines in the pull request; JSON feeds anything else.",
    points: [
      "zengin check --changed origin/main, or --staged before a commit",
      "--format pretty, github or json",
      "zengin explain prints the rules; zengin init writes the config",
      "Exit 1 on errors, so CI fails on drift and not on warnings",
    ],
    code: {
      title: "zengin check src/Actions.tsx",
      text: `src/Actions.tsx
  6:15  error  unknown-prop-value  Button has no variant "ghost-danger". Valid: solid, soft, ghost, link.
         found  variant="ghost-danger"
         fix (nearest)  variant="ghost" tone="danger"
         note  "danger" is a value of the tone prop.
  8:36  error  color-literal  Color literal in inline style (background) where a token reference is required.
         found  "#2563EB"
         fix (exact)  "var(--color-primary)"

1 file checked against @zenginui/ui@0.1.0: 8 violations (8 error, 0 warn, 0 info)`,
    },
  },
  {
    id: "rollup",
    label: "Rollup",
    title: "Drift and adoption across every repository, over time",
    body: "Each consuming repository files a snapshot in CI: violations, suppressions, forked components, which system components it uses and which version it pins. Keep every run in a directory and the rollup reads it as history: the newest run per repository is the current state, the one before is the delta, the whole series is the trend. Zengin's own examples report on every push; the result is hosted at /rollup/.",
    points: [
      "zengin report --into reports files each run as <repo>/<time>.json; zengin rollup reports reads them all",
      "Violations per 100 files, so repositories of different sizes compare; sparklines and totals over time",
      "Suppressions without a reason, new suppressions, stale versions, uncontracted use",
      "Markdown for a pull request or a channel, JSON for tooling, HTML for a hosted page with no scripts",
    ],
    code: {
      title: "zengin rollup reports/",
      text: `# @zenginui/ui across 3 repositories

| Repository | Version | Files | Violations | /100 | Suppressed | Owned | Adoption | Trend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| acme/checkout | 0.1.0 | 200 | 30 (+10) | 15 | 1 | 2 | 45 uses, 2 components | 26 → 20 → 30 |
| acme/admin | 0.0.9 behind | 50 | 4 (-5) | 8 | 1 | 2 | 45 uses, 2 components | 12 → 9 → 4 |
| acme/marketing | 0.1.0 | 40 | 0 | 0 | 3 | 0 | 7 uses, 1 component | 0 → 0 → 0 |

Over 3 moments since 2026-08-31: violations 38 to 34, component uses 61 to 97, suppressions 2 to 5.

## Needs attention
- acme/checkout: violations up by 10 since the previous run (30 now).
- acme/marketing: 2 zengin-allow comments without a reason.
- acme/admin: pins 0.0.9, behind 0.1.0.`,
    },
  },
];

export type RuleRow = { id: string; family: "foundation" | "contract" | "substitution"; description: string };

/** packages/engine/src/docs.ts, shortened for the table; `zengin explain` prints the full text. */
export const RULES: RuleRow[] = [
  { id: "color-literal", family: "foundation", description: "A color literal (hex, rgb, oklch, named) in a class, inline style or CSS where a token reference is required. A literal that equals a token's value is still a violation: it will not follow theme changes." },
  { id: "spacing-literal", family: "foundation", description: "An arbitrary length on margin, padding, gap or scroll offsets that is not on the spacing scale. Position offsets are coordinates and are not judged." },
  { id: "token-reference", family: "foundation", description: "A utility class or var() reference to a token that does not exist in the system, in a namespace the system defines tokens for." },
  { id: "unknown-prop", family: "contract", description: "A prop passed to a system component that its manifest does not declare. DOM, aria-, data- and on* props pass through." },
  { id: "unknown-prop-value", family: "contract", description: "An enum value the component does not accept, or one added in a newer system version than the project pins. Compound values like variant=\"ghost-danger\" are decomposed into the props that express them." },
  { id: "classname-policy", family: "contract", description: "className or style on a system component setting a property the component owns. className is a placement API (margin, width, flex and grid item, position, display), not a styling API." },
  { id: "component-substitution", family: "substitution", description: "An import from a package the system shadows, a raw element styled with two or more properties a system component owns, or a raw element styled with the system's own variant function." },
];

export const FAMILY_NOTE =
  "Foundation rules run in consumer and owned files, never in theme files. Contract and substitution rules run only in consumer files: a forked component is yours to style. One line suppresses one violation, and only with a reason: // zengin-allow color-literal: hero gradient, approved in brand review. Without the reason, nothing is suppressed and the rollup counts it.";

export const PROOF = [
  { figure: "41", after: "35", title: "shadcn/taxonomy", body: "First run to final run after the engine fixes. Every violation read and classified by hand; none of the remaining ones is a false positive." },
  { figure: "128", after: "109", title: "vercel/ai-chatbot", body: "Tailwind 4, the unified radix-ui package, oklch. Definitions derived by the shadcn adapter, no hand-written config. It found a dead custom variant the project had shipped." },
  { figure: "255", after: "147", title: "umami-software/umami", body: "Not shadcn: Umami's own react-zen package, read by zengin init --from package. Tokens keep their variable names, the manifest comes from the .d.ts. It found an attribute that silently reaches the DOM and a var() whose fallback is what renders." },
  { figure: "0", after: null, title: "hand-written definitions", body: "All three field tests ran from zengin init. 422 violations classified by hand in total; every miss became a regression test in the engine." },
];

export const INSTALL = `# A new project: components copied in, engine, MCP, hook and Storybook wired
npx zenginui create acme --template marketing
cd acme && npm install && npm run dev
npm run add -- dialog tooltip
npx zenginui brand --name Acme --logo logo.svg   # palette, favicon, wordmark from one color

# An existing project: derive the definitions, then check
zengin init --from shadcn                       # or: --from package @your/design-system
zengin check`;
