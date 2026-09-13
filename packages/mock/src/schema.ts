/**
 * What mock data looks like before it is code: entities with typed fields. A field is a bare kind, or a
 * kind with options. The generator turns a schema into TypeScript that makes the data at runtime from a
 * seed, so it is deterministic, typed, and free of any dependency.
 */

export type FieldKind =
  | "id"
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "company"
  | "jobTitle"
  | "city"
  | "country"
  | "sentence"
  | "paragraph"
  | "url"
  | "phone"
  | "boolean"
  | "date"
  | "money"
  | "int"
  | "float"
  | "percent"
  | "words";

export type FieldSpec =
  | FieldKind
  | { type: "id"; prefix?: string }
  | { type: "int"; min?: number; max?: number }
  | { type: "float"; min?: number; max?: number; digits?: number }
  | { type: "money"; min?: number; max?: number }
  | { type: "percent"; min?: number; max?: number }
  | { type: "boolean"; p?: number }
  | { type: "date"; pastDays?: number; futureDays?: number }
  | { type: "enum"; values: string[]; weights?: number[] }
  | { type: "series"; length?: number; min?: number; max?: number; trend?: "up" | "down" | "flat" }
  | { type: "words"; min?: number; max?: number }
  | { type: "ref"; entity: string };

export interface EntitySchema {
  /** Singular, PascalCase: the type name. The export is the lower-case plural. */
  name: string;
  count?: number;
  fields: Record<string, FieldSpec>;
}

export interface MockSchema {
  seed?: number;
  entities: EntitySchema[];
}

/** The entities most apps show. `zengin mock users invoices` picks from these. */
export const PRESETS: Record<string, EntitySchema> = {
  users: {
    name: "User",
    count: 24,
    fields: { id: { type: "id", prefix: "USR" }, firstName: "firstName", lastName: "lastName", email: "email", jobTitle: "jobTitle", role: { type: "enum", values: ["owner", "admin", "member", "viewer"], weights: [1, 2, 8, 3] }, active: { type: "boolean", p: 0.85 }, joined: { type: "date", pastDays: 400 } },
  },
  customers: {
    name: "Customer",
    count: 24,
    fields: {
      id: { type: "id", prefix: "CUS" },
      name: "fullName",
      company: "company",
      email: "email",
      plan: { type: "enum", values: ["Free", "Starter", "Team", "Business", "Enterprise"], weights: [4, 3, 3, 2, 1] },
      mrr: { type: "money", min: 0, max: 1500 },
      status: { type: "enum", values: ["active", "trial", "past-due", "churned"], weights: [6, 2, 1, 1] },
      seats: { type: "int", min: 1, max: 60 },
      usage: { type: "series", length: 12, min: 10, max: 90 },
      since: { type: "date", pastDays: 700 },
    },
  },
  companies: {
    name: "Company",
    count: 12,
    fields: { id: { type: "id", prefix: "ORG" }, name: "company", city: "city", country: "country", employees: { type: "int", min: 3, max: 4000 }, website: "url" },
  },
  products: {
    name: "Product",
    count: 16,
    fields: { id: { type: "id", prefix: "SKU" }, name: { type: "words", min: 2, max: 3 }, price: { type: "money", min: 5, max: 900 }, stock: { type: "int", min: 0, max: 500 }, category: { type: "enum", values: ["Hardware", "Software", "Service", "Add-on"] }, rating: { type: "float", min: 2.5, max: 5, digits: 1 } },
  },
  orders: {
    name: "Order",
    count: 40,
    fields: { id: { type: "id", prefix: "ORD" }, customer: "fullName", total: { type: "money", min: 20, max: 5000 }, items: { type: "int", min: 1, max: 9 }, status: { type: "enum", values: ["pending", "paid", "shipped", "delivered", "refunded"], weights: [2, 3, 3, 6, 1] }, placed: { type: "date", pastDays: 60 } },
  },
  invoices: {
    name: "Invoice",
    count: 18,
    fields: { id: { type: "id", prefix: "INV" }, customer: "company", amount: { type: "money", min: 29, max: 2400 }, status: { type: "enum", values: ["paid", "open", "overdue", "void"], weights: [7, 2, 1, 0.5] }, issued: { type: "date", pastDays: 365 }, due: { type: "date", futureDays: 30 } },
  },
  events: {
    name: "Event",
    count: 30,
    fields: { id: { type: "id", prefix: "EVT" }, who: "fullName", what: "sentence", kind: { type: "enum", values: ["signup", "upgrade", "invoice", "support", "churn"], weights: [4, 2, 3, 2, 1] }, at: { type: "date", pastDays: 14 } },
  },
  messages: {
    name: "Message",
    count: 20,
    fields: { id: { type: "id", prefix: "MSG" }, from: "fullName", subject: { type: "words", min: 3, max: 6 }, body: "paragraph", unread: { type: "boolean", p: 0.3 }, sent: { type: "date", pastDays: 30 } },
  },
  metrics: {
    name: "Metric",
    count: 6,
    fields: { id: { type: "id", prefix: "MET" }, name: { type: "enum", values: ["Revenue", "Active users", "Conversion", "Churn", "Signups", "Tickets"] }, value: { type: "float", min: 100, max: 90000, digits: 0 }, change: { type: "percent", min: -20, max: 40 }, series: { type: "series", length: 30, min: 40, max: 100, trend: "up" } },
  },
};

/** A field with its options spelled out; bare kinds carry none. */
export interface ResolvedField {
  type: FieldKind | "enum" | "series" | "ref";
  prefix?: string;
  min?: number;
  max?: number;
  digits?: number;
  p?: number;
  pastDays?: number;
  futureDays?: number;
  values?: string[];
  weights?: number[];
  length?: number;
  trend?: "up" | "down" | "flat";
  entity?: string;
}

export function resolveField(spec: FieldSpec): ResolvedField {
  return typeof spec === "string" ? { type: spec } : (spec as ResolvedField);
}

/** The TypeScript type a field produces. */
export function fieldType(spec: FieldSpec): string {
  const f = resolveField(spec);
  switch (f.type) {
    case "boolean":
      return "boolean";
    case "int":
    case "float":
    case "money":
    case "percent":
      return "number";
    case "series":
      return "number[]";
    case "enum":
      return (f.values ?? []).map((v) => JSON.stringify(v)).join(" | ");
    default:
      return "string";
  }
}
