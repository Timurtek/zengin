import { Icon } from "@zenginui/ui";
import type { ReactNode } from "react";
import { MARKS } from "./marks";

function Mark({ d }: { d: string }) {
  return (
    <svg className="works__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

/**
 * What Zengin works with, and only that: every agent here was connected to the MCP server and returned
 * the engine's violations, and every tool below it is one the repository integrates with.
 */
const GROUPS: { label: string; items: { name: string; mark: ReactNode }[] }[] = [
  {
    label: "Agents",
    items: [
      { name: "Claude Code", mark: <Mark d={MARKS.Claude} /> },
      { name: "Codex CLI", mark: <Icon.Terminal /> },
      { name: "Cursor", mark: <Mark d={MARKS.Cursor} /> },
      { name: "MCP", mark: <Mark d={MARKS.Mcp} /> },
    ],
  },
  {
    label: "Design",
    items: [
      { name: "Figma", mark: <Mark d={MARKS.Figma} /> },
      { name: "Storybook", mark: <Mark d={MARKS.Storybook} /> },
    ],
  },
  {
    label: "Code",
    items: [
      { name: "React", mark: <Mark d={MARKS.ReactLogo} /> },
      { name: "Radix", mark: <Mark d={MARKS.Radix} /> },
      { name: "shadcn/ui", mark: <Mark d={MARKS.Shadcn} /> },
      { name: "Tailwind CSS", mark: <Mark d={MARKS.Tailwind} /> },
      { name: "GitHub Actions", mark: <Mark d={MARKS.GitHubActions} /> },
    ],
  },
];

export function WorksWith() {
  return (
    <div className="works" aria-label="Works with">
      <span className="eyebrow">Works with</span>
      <div className="works__groups">
        {GROUPS.map((g) => (
          <div key={g.label} className="works__group">
            <span className="works__label">{g.label}</span>
            <ul className="works__list">
              {g.items.map((i) => (
                <li key={i.name} className="works__item">
                  {i.mark}
                  {i.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
