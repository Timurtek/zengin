import type { RegistrySource } from "./load.js";
import type { RegistryItem } from "./schema.js";

/**
 * The items named plus everything they depend on, dependencies first, each once. Unknown names fail with
 * the list of what the registry does have, so a typo is a one-line fix.
 */
export async function resolveItems(source: RegistrySource, names: string[]): Promise<RegistryItem[]> {
  const index = await source.index();
  const known = new Set(index.items.map((i) => i.name));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length) {
    throw new Error(`Registry at ${source.location} has no item${unknown.length > 1 ? "s" : ""} ${unknown.map((n) => `"${n}"`).join(", ")}. Available: ${[...known].sort().join(", ")}.`);
  }

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

  for (const n of names) await visit(n, []);
  return ordered;
}
