import { existsSync, readFileSync } from "node:fs";
import picomatch from "picomatch";
import type { ComponentManifest, ComponentOverlay, ResolvedConfig, ResolvedSurface, SystemDefinitions, Token } from "../types.js";
import { loadTokens } from "./tokens.js";

/**
 * A surface is a part of the project that is legitimately a different design: a marketing page beside an
 * application, a print view, an embedded widget. Without one, the only ways to say "this is meant to look
 * different here" are to run two systems or to suppress the rule, and both spell a deliberate difference as
 * drift. A surface says it in the definitions, so the difference is declared and still enforced.
 *
 * What a surface may change is deliberately narrow: token values, and a component's props, `owns` and
 * `className` policy. It cannot add or remove components, because a different set of components is a
 * different system, not a different look.
 */

export interface SurfaceView {
  /** The surface's name, or undefined for the base system every unmatched file is checked against. */
  name?: string;
  definitions: SystemDefinitions;
}

export interface SurfaceResolver {
  /** The base system, used by every file no surface claims. */
  base: SurfaceView;
  /** Every view, base first, so callers can build one index per view. */
  views: SurfaceView[];
  /** Which view checks this file. The first surface whose include matches wins. */
  viewFor(path: string): SurfaceView;
}

export function resolveSurfaces(config: ResolvedConfig, base: SystemDefinitions): SurfaceResolver {
  const baseView: SurfaceView = { definitions: base };
  if (!config.surfaces.length) {
    return { base: baseView, views: [baseView], viewFor: () => baseView };
  }

  const matchers = config.surfaces.map((s) => ({ surface: s, matches: picomatch(s.include, { dot: true }), view: buildView(s, base) }));
  return {
    base: baseView,
    views: [baseView, ...matchers.map((m) => m.view)],
    viewFor(path) {
      for (const m of matchers) if (m.matches(path)) return m.view;
      return baseView;
    },
  };
}

function buildView(surface: ResolvedSurface, base: SystemDefinitions): SurfaceView {
  return {
    name: surface.name,
    definitions: {
      tokens: surface.tokensPath ? overlayTokens(base.tokens, surface.tokensPath, surface.name) : base.tokens,
      components: Object.keys(surface.components).length ? overlayComponents(base.components, surface.components, surface.name) : base.components,
    },
  };
}

/**
 * The surface's token file is layered over the base by name, so it carries only what differs. A name the base
 * does not have is added: a surface may need a token the rest of the system has no use for.
 */
function overlayTokens(base: Token[], path: string, surface: string): Token[] {
  if (!existsSync(path)) throw new Error(`zengin config: surface "${surface}" names a token file that does not exist: ${path}`);
  const overlay = loadTokens(JSON.parse(readFileSync(path, "utf8")));
  const byName = new Map(base.map((t) => [t.name, t]));
  for (const t of overlay) byName.set(t.name, t);
  return [...byName.values()];
}

function overlayComponents(base: ComponentManifest[], overlays: Record<string, ComponentOverlay>, surface: string): ComponentManifest[] {
  const known = new Set(base.map((c) => c.name));
  for (const name of Object.keys(overlays)) {
    if (!known.has(name)) {
      throw new Error(
        `zengin config: surface "${surface}" changes "${name}", which the system does not have. A surface may change a component's contract, not add one; use zengin define or zengin add for a new component.`,
      );
    }
  }
  return base.map((c) => {
    const overlay = overlays[c.name];
    if (!overlay) return c;
    return {
      ...c,
      ...(overlay.props ? { props: { ...(c.props ?? {}), ...overlay.props } } : {}),
      ...(overlay.owns ? { owns: { ...(c.owns ?? {}), ...overlay.owns } } : {}),
      ...(overlay.className ? { className: { ...(c.className ?? {}), ...overlay.className } } : {}),
    };
  });
}
