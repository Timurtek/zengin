import { existsSync, readFileSync } from "node:fs";
import picomatch from "picomatch";
import type { ComponentManifest, ComponentOverlay, ResolvedConfig, ResolvedProfile, SystemDefinitions, Token } from "../types.js";
import { loadTokens } from "./tokens.js";

/**
 * A profile is a part of the project that is legitimately a different design: a marketing page beside an
 * application, a print view, an embedded widget. Without one, the only ways to say "this is meant to look
 * different here" are to run two systems or to suppress the rule, and both spell a deliberate difference as
 * drift. A profile says it in the definitions, so the difference is declared and still enforced.
 *
 * What a profile may change is deliberately narrow: token values, and a component's props, `owns` and
 * `className` policy. It cannot add or remove components, because a different set of components is a
 * different system, not a different look.
 */

export interface ProfileView {
  /** The profile's name, or undefined for the base system every unmatched file is checked against. */
  name?: string;
  definitions: SystemDefinitions;
}

export interface ProfileResolver {
  /** The base system, used by every file no profile claims. */
  base: ProfileView;
  /** Every view, base first, so callers can build one index per view. */
  views: ProfileView[];
  /** Which view checks this file. The first profile whose include matches wins. */
  viewFor(path: string): ProfileView;
}

export function resolveProfiles(config: ResolvedConfig, base: SystemDefinitions): ProfileResolver {
  const baseView: ProfileView = { definitions: base };
  if (!config.profiles.length) {
    return { base: baseView, views: [baseView], viewFor: () => baseView };
  }

  const matchers = config.profiles.map((s) => ({ profile: s, matches: picomatch(s.include, { dot: true }), view: buildView(s, base) }));
  return {
    base: baseView,
    views: [baseView, ...matchers.map((m) => m.view)],
    viewFor(path) {
      for (const m of matchers) if (m.matches(path)) return m.view;
      return baseView;
    },
  };
}

function buildView(profile: ResolvedProfile, base: SystemDefinitions): ProfileView {
  return {
    name: profile.name,
    definitions: {
      tokens: profile.tokensPath ? overlayTokens(base.tokens, profile.tokensPath, profile.name) : base.tokens,
      components: Object.keys(profile.components).length ? overlayComponents(base.components, profile.components, profile.name) : base.components,
    },
  };
}

/**
 * The profile's token file is layered over the base by name, so it carries only what differs. A name the base
 * does not have is added: a profile may need a token the rest of the system has no use for.
 */
function overlayTokens(base: Token[], path: string, profile: string): Token[] {
  if (!existsSync(path)) throw new Error(`zengin config: profile "${profile}" names a token file that does not exist: ${path}`);
  const overlay = loadTokens(JSON.parse(readFileSync(path, "utf8")));
  const byName = new Map(base.map((t) => [t.name, t]));
  for (const t of overlay) byName.set(t.name, t);
  return [...byName.values()];
}

function overlayComponents(base: ComponentManifest[], overlays: Record<string, ComponentOverlay>, profile: string): ComponentManifest[] {
  const known = new Set(base.map((c) => c.name));
  for (const name of Object.keys(overlays)) {
    if (!known.has(name)) {
      throw new Error(
        `zengin config: profile "${profile}" changes "${name}", which the system does not have. A profile may change a component's contract, not add one; use zengin define or zengin add for a new component.`,
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
