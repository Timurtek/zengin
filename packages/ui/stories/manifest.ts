import type { ComponentManifest } from "@zengin/engine";
import manifests from "../zengin/components.json";

/**
 * Stories read the same manifest the engine enforces against. Controls, variant matrices and the
 * story-coverage test all derive from it, so a manifest that disagrees with a component shows up here first.
 */
const byName = new Map((manifests as unknown as ComponentManifest[]).map((m) => [m.name, m]));

export function manifest(name: string): ComponentManifest {
  const m = byName.get(name);
  if (!m) throw new Error(`No manifest for ${name}`);
  return m;
}

/** Enum values for a prop, in manifest order. */
export function values(component: string, prop: string): string[] {
  const p = manifest(component).props?.[prop];
  if (!p?.values) throw new Error(`${component}.${prop} is not an enum prop`);
  return p.values;
}

/** Storybook argTypes for every enum and boolean prop the manifest declares. */
export function argTypesFor(component: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(manifest(component).props ?? {})) {
    if (p.type === "enum") out[name] = { control: "select", options: p.values, table: { defaultValue: p.default === undefined ? undefined : { summary: String(p.default) } } };
    else if (p.type === "boolean") out[name] = { control: "boolean" };
    else if (p.type === "number") out[name] = { control: "number" };
    else if (p.type === "string") out[name] = { control: "text" };
    else out[name] = { control: false };
  }
  return out;
}

/** What className may set, for the docs description. */
export function classNameAllow(component: string): string {
  const allow = manifest(component).className?.allow ?? [];
  return allow.length ? `className may set: ${allow.join(", ")}.` : "className is not a styling API on this component.";
}
