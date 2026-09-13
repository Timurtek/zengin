import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  createEngine,
  loadConfigFile,
  readProjectFiles,
  resolveConfig,
  type Engine,
  type FileInput,
  type ResolvedConfig,
} from "@zenginui/engine";

const CONFIG_NAMES = ["zengin.config.yaml", "zengin.config.yml"];

/** Owns the engine for one project: config discovery, lazy engine creation, and file reading. */
export interface Host {
  readonly configPath: string;
  readonly projectDir: string;
  readonly config: ResolvedConfig;
  engine(): Promise<Engine>;
  /** Reads project files by project-relative path, or every file in scope when no paths are given. */
  readFiles(paths?: string[]): FileInput[];
  /** Normalises a path the agent supplied (absolute or relative) to a project-relative, forward-slash path. */
  relativize(path: string): string;
}

/**
 * Finds the config: an explicit path, `ZENGIN_CONFIG`, or the nearest `zengin.config.yaml` walking up from
 * `startDir`. Throws with an actionable message when none is found.
 */
export function findConfig(explicit: string | undefined, startDir: string): string {
  if (explicit) {
    const p = resolve(startDir, explicit);
    if (!existsSync(p)) throw new Error(`Zengin config not found at ${p}.`);
    return p;
  }
  const fromEnv = process.env["ZENGIN_CONFIG"];
  if (fromEnv) {
    const p = resolve(startDir, fromEnv);
    if (!existsSync(p)) throw new Error(`ZENGIN_CONFIG points to ${p}, which does not exist.`);
    return p;
  }
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `No zengin.config.yaml found in ${startDir} or any parent. Pass --config <path>, set ZENGIN_CONFIG, or create one at the project root.`,
  );
}

export function createHost(configPath: string): Host {
  const { config, dir } = loadConfigFile(configPath);
  const resolved = resolveConfig(config, dir);
  let engine: Promise<Engine> | undefined;

  const relativize = (path: string): string => {
    const abs = isAbsolute(path) ? path : join(dir, path);
    return relative(dir, abs).replace(/\\/g, "/");
  };

  return {
    configPath,
    projectDir: dir,
    config: resolved,
    engine() {
      // Load the project's stylesheets once, so single-file checks can resolve className against them.
      engine ??= createEngine(resolved).then((e) => {
        const css = readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude).filter((f) => /\.css$/.test(f.path));
        e.loadStylesheets(css);
        return e;
      });
      return engine;
    },
    readFiles(paths) {
      if (!paths || paths.length === 0) {
        return readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude);
      }
      return paths.map((p) => {
        const rel = relativize(p);
        const abs = join(dir, rel);
        if (!existsSync(abs)) throw new Error(`File not found: ${rel} (resolved against ${dir}).`);
        return { path: rel, content: readFileSync(abs, "utf8") };
      });
    },
    relativize,
  };
}
