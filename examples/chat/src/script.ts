/**
 * Scripted replies for the transport, so the app runs and streams without a model or a key. Each reply is
 * what a real assistant turn contains: thinking, sometimes a tool call, an answer in markdown, sources.
 * Replace the transport with the SDK's DefaultChatTransport and a route to talk to a real model.
 */

export interface ScriptedTool {
  name: string;
  input: unknown;
  output: unknown;
}

export interface ScriptedReply {
  /** Lower-cased words that pick this reply; the first reply with none is the fallback. */
  match?: string[];
  reasoning: string;
  tool?: ScriptedTool;
  text: string;
  sources?: { url: string; title?: string }[];
}

export const SUGGESTIONS = ["What does color-literal catch?", "Check src/Actions.tsx", "How do I add a theme?", "Explain the owned pragma"];

export const REPLIES: ScriptedReply[] = [
  {
    match: ["color-literal", "color literal", "catch"],
    reasoning: "The user asks about one rule. The rule docs say what it checks and give the semantic mode; I should quote the definition and add the one non-obvious point: a literal that equals a token is still a violation.",
    text: `**color-literal** flags a color written as a value where a token reference is required: a hex, an \`rgb()\`, an \`oklch()\`, or a named color, in a class, an inline style, or CSS.

The part people miss: a literal that *equals* a token's value is still a violation. \`#2563EB\` matches \`color.primary\` in the default theme, so the fix is exact, but the literal will not follow a theme change. That is the whole reason the token exists.

In \`semantic\` mode, Tailwind palette utilities such as \`bg-red-500\` count too; the fix goes by role, so red becomes \`danger\`.`,
    sources: [{ url: "https://zengin-marketing-site.vercel.app/#rules", title: "The seven rule kinds" }],
  },
  {
    match: ["check", "actions.tsx", "violations"],
    reasoning: "A file path. Run the check on that path only rather than the whole scope, then summarise by rule and show the first fix, since the user will want to apply it.",
    tool: {
      name: "zengin_check_code",
      input: { path: "src/Actions.tsx" },
      output: { violations: 8, byRule: { "color-literal": 3, "spacing-literal": 2, "unknown-prop-value": 1, "unknown-prop": 1, "component-substitution": 1 } },
    },
    text: `Eight violations in \`src/Actions.tsx\`, all with fixes:

| Rule | Count |
| --- | --- |
| color-literal | 3 |
| spacing-literal | 2 |
| unknown-prop-value | 1 |
| unknown-prop | 1 |
| component-substitution | 1 |

The first one, on line 8, is a raw \`<button>\` styled as the system's Button. The fix keeps the label and moves the styling into props:

\`\`\`tsx
<Button tone="primary">Approve</Button>
\`\`\`

Want me to apply all eight?`,
  },
  {
    match: ["theme", "brand"],
    reasoning: "Two commands cover this: theme swaps a registry theme in, brand generates one from a color. The user said add, so the theme command is the answer, with brand as the follow-up.",
    text: `Two ways, depending on whether you want one of the registry's themes or your own.

1. **A registry theme**: \`zengin theme\` lists them (brutal, default, meadow, plex, spec-sheet, zengin), and \`zengin theme plex\` swaps your brand file and the fonts link. Nothing else in the project changes.
2. **Your own**: \`zengin brand --name Acme --logo logo.svg\` derives a whole palette from the logo's color in OKLCH, pushes every pairing to WCAG AA in both schemes, and writes the brand file, a favicon and a wordmark component.

Either way the components have no idea; a brand is one file of token overrides.`,
    sources: [
      { url: "https://github.com/Timurtek/zengin/tree/main/packages/registry#themes-and-brands", title: "Themes and brands" },
      { url: "https://github.com/Timurtek/zengin/tree/main/packages/cli#theme-and-brand", title: "zengin theme and zengin brand" },
    ],
  },
  {
    match: ["owned", "pragma", "fork"],
    reasoning: "The pragma marks a copied component as the project's own. I should explain what changes for the engine (contract rules off, foundation rules on) and what the version is for (the rollup).",
    text: `Every component \`zengin create\` copies into your project opens with a line like:

\`\`\`ts
/* zengin-owned Button, forked from @zenginui/ui@0.1.0 */
\`\`\`

It tells the engine two things. The file is **yours**: the contract and substitution rules are off inside it, so you can restyle the Button however you like. And it came **from somewhere**: the foundation rules still apply, so every value in it must be a token, and the rollup can report how far your fork has drifted from the version you took it from.`,
  },
  {
    reasoning: "Nothing specific to look up. A short orientation is the honest answer, with the things the user can ask next.",
    text: `I can explain any of the seven rules, check a file and hand back the fixes, or walk you through themes, brands and the registry. Try one of the suggestions, or ask in your own words.`,
  },
];

export function pickReply(userText: string): ScriptedReply {
  const q = userText.toLowerCase();
  return REPLIES.find((r) => r.match?.some((m) => q.includes(m))) ?? REPLIES[REPLIES.length - 1]!;
}
