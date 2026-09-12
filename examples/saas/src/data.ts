/** Mock data for the dashboard, generated deterministically so every run and every preview looks the same. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260912);

export const DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 7, 14 + i);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
});

export const revenue = DAYS.map((_, i) => Math.round(18400 + i * 310 + Math.sin(i / 2.6) * 2100 + rand() * 900));
export const refunds = DAYS.map((_, i) => Math.round(620 + Math.cos(i / 3.1) * 260 + (i % 7 === 5 ? 540 : 0) + rand() * 180));
export const activeUsers = DAYS.map((_, i) => Math.round(2900 + i * 14 + Math.sin(i / 4) * 120 + rand() * 60));
export const conversion = DAYS.map((_, i) => Number((3.1 + Math.sin(i / 5) * 0.4 + rand() * 0.2).toFixed(2)));
export const churn = DAYS.map((_, i) => Number((1.9 - i * 0.012 + Math.cos(i / 3) * 0.2 + rand() * 0.1).toFixed(2)));

export const PLANS = ["Free", "Starter", "Team", "Business", "Enterprise"] as const;
export type Plan = (typeof PLANS)[number];
export const signupsByPlan = { thisMonth: [842, 396, 251, 88, 14], lastMonth: [781, 372, 233, 79, 11] };

export type CustomerStatus = "active" | "trial" | "past-due" | "churned";

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  plan: Plan;
  mrr: number;
  status: CustomerStatus;
  seats: number;
  usage: number[];
  joined: string;
}

const FIRST = ["Ada", "Grace", "Linus", "Mina", "Jonas", "Priya", "Tomás", "Yuki", "Farah", "Noah", "Ines", "Kwame", "Sofia", "Emil", "Leila", "Marcus", "Hana", "Diego", "Aisha", "Olu", "Petra", "Ravi", "Zoe", "Bram"];
const LAST = ["Okafor", "Lindqvist", "Raman", "Brewster", "Sato", "Haddad", "Mendes", "Novak", "Achebe", "Costa", "Weber", "Ivanova", "Delacroix", "Osei", "Nakamura", "Fischer", "Rossi", "Kaur", "Berg", "Moreau", "Silva", "Andersen", "Tanaka", "Dubois"];
const COMPANIES = ["Northwind", "Lumen Labs", "Halyard", "Tessel", "Quarry", "Brightline", "Ferro", "Oakline", "Meridian", "Pipeworks", "Sable", "Kestrel", "Ridgeway", "Alder", "Vantage", "Cobalt Works", "Harbor", "Slate", "Fathom", "Juniper", "Beacon", "Marlow", "Cinder", "Trellis"];
const STATUS: CustomerStatus[] = ["active", "active", "active", "active", "trial", "past-due", "active", "churned"];
const MRR: Record<Plan, number> = { Free: 0, Starter: 29, Team: 99, Business: 349, Enterprise: 1490 };

export const customers: Customer[] = FIRST.map((first, i) => {
  const plan = PLANS[Math.min(4, Math.floor(rand() * 6))]!;
  const status = STATUS[Math.floor(rand() * STATUS.length)]!;
  const seats = plan === "Free" ? 1 : plan === "Enterprise" ? 40 + Math.floor(rand() * 80) : 2 + Math.floor(rand() * 14);
  const base = 20 + rand() * 60;
  const joined = new Date(2026, Math.floor(rand() * 8), 1 + Math.floor(rand() * 27));
  return {
    id: `CUS-${1040 + i}`,
    name: `${first} ${LAST[i]}`,
    company: COMPANIES[i]!,
    email: `${first.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@${COMPANIES[i]!.toLowerCase().replace(/\s+/g, "")}.com`,
    plan,
    mrr: status === "churned" ? 0 : MRR[plan] * (plan === "Enterprise" ? 1 : Math.max(1, Math.round(seats / 3))),
    status,
    seats,
    usage: Array.from({ length: 12 }, (_, k) => Math.round(base + Math.sin(k / 2 + i) * 12 + rand() * 10)),
    joined: joined.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
});

export interface Activity {
  id: string;
  who: string;
  what: string;
  when: string;
  kind: "signup" | "upgrade" | "invoice" | "support" | "churn";
}

export const activity: Activity[] = [
  { id: "a1", who: "Priya Haddad", what: "upgraded Halyard to Business", when: "12 min ago", kind: "upgrade" },
  { id: "a2", who: "Tomás Mendes", what: "signed up for Team, 6 seats", when: "41 min ago", kind: "signup" },
  { id: "a3", who: "Northwind", what: "invoice INV-2381 paid", when: "2 h ago", kind: "invoice" },
  { id: "a4", who: "Yuki Novak", what: "opened a support ticket: SSO login loop", when: "3 h ago", kind: "support" },
  { id: "a5", who: "Sable", what: "cancelled Starter at period end", when: "Yesterday", kind: "churn" },
  { id: "a6", who: "Ines Weber", what: "signed up for Free", when: "Yesterday", kind: "signup" },
];

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "open" | "failed";
}

export const invoices: Invoice[] = [
  { id: "INV-2381", date: "Sep 1, 2026", amount: 349, status: "paid" },
  { id: "INV-2290", date: "Aug 1, 2026", amount: 349, status: "paid" },
  { id: "INV-2204", date: "Jul 1, 2026", amount: 349, status: "paid" },
  { id: "INV-2117", date: "Jun 1, 2026", amount: 299, status: "paid" },
  { id: "INV-2031", date: "May 1, 2026", amount: 299, status: "failed" },
];

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
