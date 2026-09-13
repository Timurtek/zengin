/**
 * The catalog, paired with what `zengin mock` generated in src/mock from mock.json. The catalog holds what
 * a shop writes once: names, copy, prices, categories. The rows hold what changes: stock, rating, review
 * counts, what is on sale. Regenerate the rows with `npm run mock`; change the seed for a different day.
 */

import { listings } from "./mock/listings";

export type Category = "Desk" | "Input" | "Paper" | "Audio";
export const CATEGORIES: Category[] = ["Desk", "Input", "Paper", "Audio"];

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  price: number;
  /** From the mock rows. */
  stock: number;
  rating: number;
  reviews: number;
  sale: boolean;
  /** Price on sale, when it is. */
  was?: number;
}

const CATALOG: Omit<Product, "id" | "stock" | "rating" | "reviews" | "sale">[] = [
  { name: "Keystone 75", tagline: "A 75-key board with a gasket mount", description: "Hot-swappable switches, a rotary knob, and a case that does not ring. Ships with tactile switches and PBT caps.", category: "Input", price: 189 },
  { name: "Ledger desk mat", tagline: "Wool felt, 90 by 40", description: "Dense felt over a non-slip base. Absorbs the sound of a keyboard and the mouse never skids.", category: "Desk", price: 48 },
  { name: "Draft notebook", tagline: "A5, dot grid, lies flat", description: "Ninety-six pages of 100 gsm paper with a two millimetre dot grid. Bound to open flat from the first page.", category: "Paper", price: 16 },
  { name: "Atlas monitor arm", tagline: "Single arm, gas spring, to 34 inches", description: "Clamps or grommets, cable channel along the arm, and a joint that stays where you put it.", category: "Desk", price: 129 },
  { name: "Trackball TB-2", tagline: "Thumb ball, five buttons, two connections", description: "A 34 millimetre ball on ceramic bearings. Pairs to two machines and switches with one press.", category: "Input", price: 92 },
  { name: "Quiet headset", tagline: "Closed back, boom mic, two days of battery", description: "Forty millimetre drivers tuned for voices. The mic mutes when you raise it and the light says so.", category: "Audio", price: 159 },
  { name: "Index cards, 300", tagline: "Blank, heavy, three colours", description: "Three hundred cards at 250 gsm in white, grey and manila. For the wall, the desk, the plan.", category: "Paper", price: 12 },
  { name: "Low desk lamp", tagline: "Warm to cool, no glare", description: "A flat head that lights the desk and not your eyes. Dims to a glow; remembers the last setting.", category: "Desk", price: 74 },
  { name: "Keycap set, mono", tagline: "PBT, cherry profile, 140 keys", description: "Legends in a monospace face, dye-sublimated so they never wear. Covers 60 to full size.", category: "Input", price: 68 },
  { name: "Pocket speaker", tagline: "One driver, one button, all day", description: "Pairs in a second and fills a small room. The button plays, pauses and answers the phone.", category: "Audio", price: 59 },
  { name: "Weekly planner", tagline: "A4, undated, one page a week", description: "Fifty-four weeks with a column for each day and a margin for the things that are not days.", category: "Paper", price: 22 },
  { name: "Cable tray", tagline: "Steel, under the desk, out of sight", description: "Holds a power strip and every brick. Screws or clamps; the finish matches the arm.", category: "Desk", price: 36 },
];

export const PRODUCTS: Product[] = CATALOG.map((p, i) => {
  const row = listings[i % listings.length]!;
  const sale = row.sale && row.stock > 0;
  return { ...p, id: row.id, stock: row.stock, rating: row.rating, reviews: row.reviews, sale, ...(sale ? { was: p.price, price: Math.round(p.price * 0.8) } : {}) };
});

export type Sort = "featured" | "price-asc" | "price-desc" | "rating";
export const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "rating", label: "Best rated" },
];

export function sortProducts(products: Product[], sort: Sort): Product[] {
  const out = [...products];
  if (sort === "price-asc") out.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") out.sort((a, b) => b.price - a.price);
  if (sort === "rating") out.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  return out;
}

export const SHIPPING = 8;
export const FREE_SHIPPING_FROM = 120;

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
