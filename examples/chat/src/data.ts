/**
 * The sidebar's conversations, read from the rows `zengin mock` generated in src/mock from mock.json. The
 * rows carry when a conversation happened and how long it ran; the titles are prose, so they come from the
 * catalog below in order. The replies themselves are scripted in script.ts and stay that way: they are the
 * demo, not data. Regenerate the rows with `npm run mock`.
 */

import { threads as rows } from "./mock/threads";

export interface Thread {
  id: string;
  title: string;
  /** "Now", "Yesterday", a weekday for the last week, else a date. */
  when: string;
  turns: number;
}

const TITLES = ["Rules and fixes", "Theming the dashboard", "Rollup for the platform team", "Migrating the checkout to Button", "Which icon set for the admin", "Dark mode surfaces", "Storybook for the design review", "Spacing scale for the stepper"];

/** The mock's fixed "now"; the generated dates are relative to it, so the labels are too. */
const NOW = Date.UTC(2026, 8, 12);
const DAY = 86400000;
const label = (iso: string, first: boolean): string => {
  if (first) return "Now";
  const d = new Date(`${iso}T00:00:00Z`);
  const days = Math.round((NOW - d.getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export const THREADS: Thread[] = [...rows]
  .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  .map((t, i) => ({ id: t.id, title: TITLES[i % TITLES.length]!, when: label(t.at, i === 0), turns: t.turns }));
