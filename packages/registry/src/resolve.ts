import type { RegistrySource } from "./load.js";
import type { RegistryItem } from "./schema.js";

/**
 * The items named plus everything they depend on, dependencies first, each once. Unknown names fail with
 * the list of what the registry does have, so a typo is a one-line fix.
 */
export async function resolveItems(source: RegistrySource, names: string[]): Promise<RegistryItem[]> {
  const { items, unknown, known } = await resolveSome(source, names);
  if (unknown.length) throw new Error(unknownItemsMessage(source.location, unknown, known));
  return items;
}

/** A name the registry does not have, with the closest thing it does. */
export interface UnknownItem {
  name: string;
  didYouMean?: string;
}

/**
 * Resolves what it can and reports what it cannot, instead of refusing the batch.
 *
 * `zengin add markdown tabs codeblock skeleton loader` used to add nothing at all, because one name in five
 * was `codeblock` rather than `code-block`. Four correct names being thrown away for one typo is a bad
 * trade, and the registry always knew what was meant.
 */
export async function resolveSome(source: RegistrySource, names: string[]): Promise<{ items: RegistryItem[]; unknown: UnknownItem[]; known: string[] }> {
  const index = await source.index();
  const known = new Set(index.items.map((i) => i.name));
  const unknown: UnknownItem[] = names
    .filter((n) => !known.has(n))
    .map((n) => {
      const guess = nearestName(n, [...known]);
      return guess ? { name: n, didYouMean: guess } : { name: n };
    });
  const wanted = names.filter((n) => known.has(n));

  const ordered: RegistryItem[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();

  async function visit(name: string, trail: string[]): Promise<void> {
    if (seen.has(name)) return;
    if (visiting.has(name)) throw new Error(`Registry dependency cycle: ${[...trail, name].join(" -> ")}`);
    visiting.add(name);
    const item = await source.item(name);
    for (const dep of item.registryDependencies) await visit(dep, [...trail, name]);
    visiting.delete(name);
    seen.add(name);
    ordered.push(item);
  }

  for (const n of wanted) await visit(n, []);
  return { items: ordered, unknown, known: [...known] };
}

/** The registry's own name for something, when a wrong one is close enough to be a typo rather than a guess. */
function nearestName(name: string, known: string[]): string | undefined {
  const squash = (v: string) => v.replace(/[^a-z0-9]/g, "").toLowerCase();
  const target = squash(name);
  // `codeblock` for `code-block` is the common case: the right letters, the wrong punctuation.
  const exact = known.find((k) => squash(k) === target);
  if (exact) return exact;
  let best: { name: string; d: number } | undefined;
  for (const k of known) {
    const d = distance(target, squash(k));
    if (d <= 2 && (!best || d < best.d)) best = { name: k, d };
  }
  return best?.name;
}

/** Levenshtein, bounded by the caller. */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = t;
    }
  }
  return prev[b.length]!;
}

export function unknownItemsMessage(location: string, unknown: UnknownItem[], known?: string[]): string {
  const parts = unknown.map((u) => `"${u.name}"${u.didYouMean ? ` (did you mean "${u.didYouMean}"?)` : ""}`);
  // The full list stays: it is how someone finds the right name when the guess is wrong or absent.
  const available = known?.length ? ` Available: ${[...known].sort().join(", ")}.` : "";
  return `Registry at ${location} has no item${unknown.length > 1 ? "s" : ""} ${parts.join(", ")}.${available}`;
}
