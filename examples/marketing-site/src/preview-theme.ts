/**
 * Preview harness for the marketing site's catalog, not part of the template. When the page is opened
 * with ?theme=<name>, the theme's brand file is fetched from the registry the site serves at /r and
 * applied over this app's own styles, fonts included; ?fonts=<pairing> sets the three font tokens to a
 * pairing the same way `zengin fonts` does; ?icons=<set> draws the icon vocabulary from a react-icons set the
 * way `zengin icons` does. Without the parameters, or outside the site, it does nothing.
 */
const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
const fonts = params.get("fonts");
const valid = (s: string | null): s is string => Boolean(s && /^[a-z0-9-]+$/.test(s));

const link = (families: string[]) => {
  const el = document.createElement("link");
  el.rel = "stylesheet";
  el.href = `https://fonts.googleapis.com/css2?${families
    .map((f) => {
      const [family, weights] = f.split(":");
      return `family=${encodeURIComponent(family!.trim()).replace(/%20/g, "+")}:wght@${weights ?? "400;500;600;700"}`;
    })
    .join("&")}&display=swap`;
  document.head.appendChild(el);
};

const item = (name: string) => fetch(`/r/items/${name}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

const applyTheme = valid(theme)
  ? item(theme).then((t: { files: { path: string; content: string }[]; fonts?: string[] }) => {
      const css = t.files.find((f) => f.path.endsWith("brand.css"))?.content;
      if (!css) return;
      if (t.fonts?.length) link(t.fonts);
      const style = document.createElement("style");
      style.dataset["zenginTheme"] = theme;
      style.textContent = css;
      document.head.appendChild(style);
    })
  : Promise.resolve();

if (valid(fonts)) {
  // After the theme, so the pairing's tokens win over the theme's.
  applyTheme
    .then(() => item(`fonts-${fonts}`))
    .then((f: { pairing?: { display: Role; sans: Role; mono: Role } }) => {
      const p = f.pairing;
      if (!p) return;
      link([...new Set([p.display, p.sans, p.mono].map((r) => `${r.family}:${r.weights.join(";")}`))]);
      const sans = "ui-sans-serif, system-ui, sans-serif";
      const serif = "ui-serif, Georgia, serif";
      const stack = (r: Role, then?: Role) => `"${r.family}", ${then && then.family !== r.family ? `"${then.family}", ` : ""}${r.serif ? serif : sans}`;
      const style = document.createElement("style");
      style.dataset["zenginFonts"] = fonts;
      style.textContent = `:root { --font-sans: ${stack(p.sans)}; --font-display: ${stack(p.display, p.sans)}; --font-mono: "${p.mono.family}", ui-monospace, SFMono-Regular, Menlo, monospace; }`;
      document.head.appendChild(style);
    })
    .catch(() => {
      // No registry here: the app shows as authored.
    });
} else {
  applyTheme.catch(() => {});
}

// ?icons=<set>: the same swap `zengin icons` performs, done at runtime for the previews. The set's module is
// loaded on demand; only the vocabulary's names are taken from it.
const icons = params.get("icons");
const LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  lucide: () => import("react-icons/lu"),
  tabler: () => import("react-icons/tb"),
  phosphor: () => import("react-icons/pi"),
  heroicons: () => import("react-icons/hi2"),
  feather: () => import("react-icons/fi"),
  radix: () => import("react-icons/rx"),
  material: () => import("react-icons/md"),
  bootstrap: () => import("react-icons/bs"),
};
if (valid(icons) && LOADERS[icons]) {
  Promise.all([item(`icons-${icons}`), LOADERS[icons]!(), import("@zenginui/ui")])
    .then(([meta, mod, ui]: [{ iconSet?: { names: Record<string, string> } }, Record<string, unknown>, { setIconSet: (s: Record<string, unknown>) => void }]) => {
      const names = meta.iconSet?.names ?? {};
      ui.setIconSet(Object.fromEntries(Object.entries(names).map(([k, v]) => [k, mod[v]]).filter(([, c]) => typeof c === "function")));
    })
    .catch(() => {
      // No registry or no set here: the app shows as authored.
    });
}

interface Role {
  family: string;
  weights: number[];
  serif?: boolean;
}

export {};
