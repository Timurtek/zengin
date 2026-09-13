import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isRegistryIndex, type Registry, type RegistryIndex, type RegistryItem } from "./schema.js";

/** A registry the client can list and fetch items from, whether it is a directory, a URL, or in memory. */
export interface RegistrySource {
  readonly location: string;
  index(): Promise<RegistryIndex>;
  item(name: string): Promise<RegistryItem>;
}

export const DEFAULT_REGISTRY = "https://zengin.timurtek.com/r";

/** `source` is a directory written by writeRegistry, or the base URL such a directory is served from. */
export function openRegistry(source: string = process.env["ZENGIN_REGISTRY"] ?? DEFAULT_REGISTRY): RegistrySource {
  if (/^https?:\/\//.test(source)) return remote(source.replace(/\/$/, ""));
  if (!existsSync(join(source, "index.json"))) throw new Error(`No registry at ${source}: index.json not found. Build one with \`zengin registry build --out <dir>\`.`);
  return local(source);
}

export function registryFromMemory(registry: Registry): RegistrySource {
  const byName = new Map(registry.items.map((i) => [i.name, i]));
  return {
    location: "memory",
    async index() {
      return { ...registry, items: registry.items.map(({ files: _f, manifest: _m, ...rest }) => rest) };
    },
    async item(name) {
      const it = byName.get(name);
      if (!it) throw new Error(`Registry has no item "${name}".`);
      return it;
    },
  };
}

function local(dir: string): RegistrySource {
  return {
    location: dir,
    async index() {
      const parsed = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as unknown;
      if (!isRegistryIndex(parsed)) throw new Error(`${dir}/index.json is not a Zengin registry index.`);
      return parsed;
    },
    async item(name) {
      const p = join(dir, "items", `${name}.json`);
      if (!existsSync(p)) throw new Error(`Registry at ${dir} has no item "${name}".`);
      return JSON.parse(readFileSync(p, "utf8")) as RegistryItem;
    },
  };
}

function remote(base: string): RegistrySource {
  const get = async (path: string): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetch(`${base}/${path}`);
    } catch (e) {
      throw new Error(`Could not reach the registry at ${base}: ${(e as Error).message}. Pass --registry <dir|url> or set ZENGIN_REGISTRY.`);
    }
    if (!res.ok) throw new Error(`Registry ${base}/${path} answered ${res.status}.`);
    return res.json();
  };
  return {
    location: base,
    async index() {
      const parsed = await get("index.json");
      if (!isRegistryIndex(parsed)) throw new Error(`${base}/index.json is not a Zengin registry index.`);
      return parsed;
    },
    async item(name) {
      return (await get(`items/${name}.json`)) as RegistryItem;
    },
  };
}
