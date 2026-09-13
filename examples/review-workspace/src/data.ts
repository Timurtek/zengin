/**
 * The queue's data, read from the rows `zengin mock` generated in src/mock from mock.json. The rows carry
 * what makes a queue look real, who, when and where each item stands; the changes themselves are prose,
 * so they come from the catalog below and are paired with the rows in order. Regenerate the rows with
 * `npm run mock`; change the count or the seed in mock.json and the queue follows.
 */

import { reviews, type Review } from "./mock/reviews";

export type ReviewStatus = Review["status"];

export interface ReviewItem {
  id: string;
  title: string;
  author: string;
  summary: string;
  status: ReviewStatus;
  submitted: string;
}

/** What a design-system review queue holds: token adoption, component substitution, approved exceptions, proposals. */
const CHANGES: { title: string; summary: string }[] = [
  { title: "Checkout: replace hardcoded brand blue with color.primary", summary: "Swaps eleven #3B82F6 literals for the token so the checkout follows the theme. No visual change in the default theme." },
  { title: "Settings: adopt system Dialog for the delete confirmation", summary: "Removes the Headless UI dialog and the second focus-trap implementation. Migrates onClose to onOpenChange." },
  { title: "Marketing hero: approved gradient exception", summary: "The hero gradient is a brand illustration. Adds the zengin-allow comment with the review reference." },
  { title: "Data table: density variant", summary: "Proposes a compact density for the table. Needs a spacing.1 row padding token before it can land." },
  { title: "Billing: raw buttons in the invoice list become Button", summary: "Six styled <button> elements, one of them with its own focus ring. All become Button with the matching tone; the ring goes." },
  { title: "Onboarding: spacing literals on the stepper", summary: "Nine pixel values in the stepper's inline styles, eight on the scale and one 13px nudge. The nudge becomes spacing.3 with a note." },
  { title: "Icons: the vocabulary instead of a second icon package", summary: "Drops lucide-react from the checkout app; every glyph comes from Icon now, so zengin icons can change the set for the whole product." },
  { title: "Dark mode: two surfaces still hardcoded", summary: "The toast and the command menu set #fff for their background. Both become color.surface-raised, which the dark theme already defines." },
];

/** The mock's fixed "now"; the generated dates are relative to it, so the labels are too. */
const NOW = Date.UTC(2026, 8, 12);
const DAY = 86400000;
const relative = (iso: string): string => {
  const days = Math.round((NOW - new Date(`${iso}T00:00:00Z`).getTime()) / DAY);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
};

export const ITEMS: ReviewItem[] = [...reviews]
  .sort((a, b) => (a.submitted < b.submitted ? 1 : a.submitted > b.submitted ? -1 : 0))
  .map((r, i) => ({ id: r.id, ...CHANGES[i % CHANGES.length]!, author: r.author, status: r.status, submitted: relative(r.submitted) }));
