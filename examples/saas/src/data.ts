/**
 * The dashboard's data, read from the modules `zengin mock` generated in src/mock from mock.json. This file
 * is the seam between generated rows and what the pages show: it derives what a backend would derive (MRR
 * from plan and seats, signups by month, relative times) and formats what a screen formats. Regenerate the
 * rows with `npm run mock`; change a count or the seed in mock.json and every screen follows.
 */

import { customers as rows, type Customer as Row } from "./mock/customers";
import { events } from "./mock/events";
import { invoices as invoiceRows } from "./mock/invoices";
import { metrics } from "./mock/metrics";
import { signups } from "./mock/signups";

/** The mock's fixed "now": the generated dates are relative to it, so the labels are too. */
const NOW = Date.UTC(2026, 8, 12);
const DAY = 86400000;

const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const long = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const DAYS = Array.from({ length: 30 }, (_, i) => short(new Date(NOW - (29 - i) * DAY)));

const metric = metrics[0]!;
export const revenue = metric.revenue;
export const refunds = metric.refunds;
export const activeUsers = metric.activeUsers;
export const conversion = metric.conversionBps.map((n) => n / 100);
export const churn = metric.churnBps.map((n) => n / 100);

export const PLANS = ["Free", "Starter", "Team", "Business", "Enterprise"] as const;
export type Plan = (typeof PLANS)[number];

/** Signups grouped by plan for the last 30 days and the 30 before, from the signup rows. */
export const signupsByPlan = (() => {
  const thisMonth = PLANS.map(() => 0);
  const lastMonth = PLANS.map(() => 0);
  for (const s of signups) {
    const age = (NOW - parse(s.at).getTime()) / DAY;
    const bucket = age < 30 ? thisMonth : age < 60 ? lastMonth : undefined;
    if (bucket) bucket[PLANS.indexOf(s.plan)]!++;
  }
  return { thisMonth, lastMonth };
})();

export type CustomerStatus = Row["status"];

export interface Customer extends Row {
  /** Monthly recurring revenue: the plan's price per seat block, nothing for churned or free. */
  mrr: number;
  /** `since`, formatted for a screen. */
  joined: string;
}

const PRICE: Record<Plan, number> = { Free: 0, Starter: 29, Team: 99, Business: 349, Enterprise: 1490 };
/** Seats a plan can hold; the mock draws 1 to 60 and the plan says where that lands. */
const SEATS: Record<Plan, [number, number]> = { Free: [1, 1], Starter: [1, 5], Team: [2, 15], Business: [5, 40], Enterprise: [40, 120] };

const seatsFor = (plan: Plan, raw: number): number => {
  const [min, max] = SEATS[plan];
  return min + Math.round(((raw - 1) / 59) * (max - min));
};

export const customers: Customer[] = rows.map((c) => {
  const seats = seatsFor(c.plan, c.seats);
  return {
    ...c,
    seats,
    mrr: c.status === "churned" ? 0 : PRICE[c.plan] * (c.plan === "Enterprise" ? 1 : Math.max(1, Math.round(seats / 3))),
    joined: long(parse(c.since)),
  };
});

export interface Activity {
  id: string;
  who: string;
  what: string;
  when: string;
  kind: (typeof events)[number]["kind"];
}

const WHAT: Record<Activity["kind"], (c: Customer) => string> = {
  signup: (c) => `signed up for ${c.plan}${c.seats > 1 ? `, ${c.seats} seats` : ""}`,
  upgrade: (c) => `upgraded ${c.company} to ${c.plan}`,
  invoice: (c) => `paid an invoice for ${c.company}`,
  support: (c) => `opened a support ticket for ${c.company}`,
  churn: (c) => `cancelled ${c.plan} at period end`,
};

const relative = (iso: string): string => {
  const days = Math.round((NOW - parse(iso).getTime()) / DAY);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

const byId = new Map(customers.map((c) => [c.id, c]));

export const activity: Activity[] = [...events]
  .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  .map((e) => {
    const c = byId.get(e.customer)!;
    return { id: e.id, who: c.name, what: WHAT[e.kind](c), when: relative(e.at), kind: e.kind };
  });

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: (typeof invoiceRows)[number]["status"];
}

export const invoices: Invoice[] = [...invoiceRows]
  .sort((a, b) => (a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : 0))
  .map((inv) => ({ id: inv.id, date: long(parse(inv.issued)), amount: inv.amount, status: inv.status }));

/** Plan limits are configuration, not rows. */
export const quotas = [
  { name: "Seats", used: 38, limit: 50, unit: "" },
  { name: "API calls", used: 1_840_000, limit: 2_500_000, unit: "" },
  { name: "Storage", used: 412, limit: 500, unit: "GB" },
];

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function compact(n: number): string {
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}
