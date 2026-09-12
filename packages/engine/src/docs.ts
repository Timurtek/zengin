import type { RuleId } from "./types.js";

export type RuleFamily = "foundation" | "contract" | "substitution";

/** What each rule kind checks, in the words every surface shows the agent. */
export const RULE_DOCS: Record<RuleId, { family: RuleFamily; description: string }> = {
  "color-literal": {
    family: "foundation",
    description: "A color literal (hex, rgb, oklch, named) in a class, inline style or CSS where a token reference is required. In 'semantic' mode, Tailwind palette utilities such as bg-red-500 are violations too. A literal that equals a token's value is still a violation: it will not follow theme changes.",
  },
  "spacing-literal": {
    family: "foundation",
    description: "An arbitrary length on margin, padding, gap or inset that is not on the system spacing scale, or a Tailwind default-scale utility that resolves off the system scale.",
  },
  "token-reference": {
    family: "foundation",
    description: "A utility class or var() reference to a token that does not exist in the system, in a namespace the system defines tokens for.",
  },
  "unknown-prop": {
    family: "contract",
    description: "A prop passed to a system component that its manifest does not declare. Standard DOM, aria-, data- and on* props pass through.",
  },
  "unknown-prop-value": {
    family: "contract",
    description: "An enum prop value the component does not accept, or one added in a newer system version than the project pins. Compound values like variant=\"ghost-danger\" are decomposed into the props that express them.",
  },
  "classname-policy": {
    family: "contract",
    description: "className or style on a system component setting a CSS property the component owns. className is a placement API (margin, width, flex/grid item, position), not a styling API.",
  },
  "component-substitution": {
    family: "substitution",
    description: "An import from a package the system shadows (e.g. @headlessui/react Dialog), or a raw element such as <button> styled with two or more properties the system component owns.",
  },
};

export const FAMILY_NOTES =
  "Scope: foundation rules run in consumer and owned files, never in theme files. Contract and substitution rules run only in consumer files; they are off in files under scope.ownership or carrying a /* zengin-owned ... */ pragma. " +
  "Suppress one violation with a comment on the line above: // zengin-allow <rule>: <reason>. A comment without a reason does not suppress.";
