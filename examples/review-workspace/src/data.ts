export type ReviewStatus = "pending" | "approved" | "rejected" | "changes";

export interface ReviewItem {
  id: string;
  title: string;
  author: string;
  summary: string;
  status: ReviewStatus;
  submitted: string;
}

export const ITEMS: ReviewItem[] = [
  {
    id: "ZN-2041",
    title: "Checkout: replace hardcoded brand blue with color.primary",
    author: "Mina Okafor",
    summary: "Swaps eleven #3B82F6 literals for the token so the checkout follows the theme. No visual change in the default theme.",
    status: "pending",
    submitted: "2h ago",
  },
  {
    id: "ZN-2038",
    title: "Settings: adopt system Dialog for the delete confirmation",
    author: "Jonas Lindqvist",
    summary: "Removes the Headless UI dialog and the second focus-trap implementation. Migrates onClose to onOpenChange.",
    status: "pending",
    submitted: "5h ago",
  },
  {
    id: "ZN-2035",
    title: "Marketing hero: approved gradient exception",
    author: "Priya Raman",
    summary: "The hero gradient is a brand illustration. Adds the zengin-allow comment with the review reference.",
    status: "approved",
    submitted: "Yesterday",
  },
  {
    id: "ZN-2031",
    title: "Data table: density variant",
    author: "Mina Okafor",
    summary: "Proposes a compact density for the table. Needs a spacing.1 row padding token before it can land.",
    status: "changes",
    submitted: "2d ago",
  },
];
