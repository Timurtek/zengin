import type { ComponentManifest } from "@zenginui/engine";

export const REGISTRY_SCHEMA = "zengin-registry/1";

export type ItemType = "component" | "template" | "lib" | "definitions" | "theme" | "fonts" | "icons";

/** One typographic role: a Google Fonts family at the weights the components use. */
export interface FontRole {
  family: string;
  weights: number[];
  /** A serif face gets a serif fallback stack. */
  serif?: boolean;
}

/** A pairing: headlines, text and code. */
export interface FontPairing {
  display: FontRole;
  sans: FontRole;
  mono: FontRole;
}

export type FileKind = "component" | "style" | "story" | "lib" | "template" | "definitions" | "theme";

export interface RegistryFile {
  /** Path relative to the project root the item installs into. */
  path: string;
  kind: FileKind;
  content: string;
}

export interface RegistryItem {
  name: string;
  type: ItemType;
  title: string;
  description: string;
  /** npm packages the item needs at runtime. */
  dependencies: Record<string, string>;
  /** npm packages the item needs at build time. */
  devDependencies: Record<string, string>;
  /** Other registry items this one needs, installed first. */
  registryDependencies: string[];
  /**
   * Components this item's *story* names beyond what the item itself delivers. A story is documentation and
   * it is better for showing a Tooltip on a real Button, but it must not land in a project that has no
   * Button: install writes the story only when these are all present, and says so when it does not.
   */
  storyRequires?: string[];
  files: RegistryFile[];
  /** For components: the manifest entry, with `export.from` already pointing at the project alias. */
  manifest?: ComponentManifest;
  /** For themes: Google Fonts families the brand file expects, linked into index.html on apply. `Family:400;700` pins weights. */
  fonts?: string[];
  /** For fonts items: the pairing. */
  pairing?: FontPairing;
  /** For icons items: the react-icons module and the vocabulary name -> export name map. */
  iconSet?: { module: string; names: Record<string, string> };
  /** For templates: the repository directory the template is derived from, which the site builds as its live preview. */
  source?: string;
}

/** The index: every item without its file contents, so a client can list and resolve before fetching. */
export interface RegistryIndex {
  schema: typeof REGISTRY_SCHEMA;
  name: string;
  /** Version of the system the items were cut from; written into the owned pragma of installed files. */
  version: string;
  generatedAt: string;
  items: Omit<RegistryItem, "files" | "manifest">[];
}

export interface Registry extends Omit<RegistryIndex, "items"> {
  items: RegistryItem[];
}

/** Where installed files go inside a project. One convention, so `add` needs no configuration. */
export const LAYOUT = {
  componentsDir: "src/components/ui",
  alias: "@/components/ui",
  libDir: "src/lib",
  stylesIndex: "src/styles/index.css",
  storiesDir: "stories",
  definitionsDir: "zengin",
} as const;

export function isRegistryIndex(x: unknown): x is RegistryIndex {
  return typeof x === "object" && x !== null && (x as RegistryIndex).schema === REGISTRY_SCHEMA && Array.isArray((x as RegistryIndex).items);
}
