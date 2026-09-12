/**
 * Preview harness for the marketing site's catalog, not part of the template. When the page is opened
 * with ?theme=<name>, the theme's brand file is fetched from the registry the site serves at /r and
 * applied over this app's own styles, fonts included. Without the parameter, or outside the site, it
 * does nothing.
 */
const name = new URLSearchParams(window.location.search).get("theme");
if (name && /^[a-z0-9-]+$/.test(name)) {
  fetch(`/r/items/${name}.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((item: { files: { path: string; content: string }[]; fonts?: string[] }) => {
      const css = item.files.find((f) => f.path.endsWith("brand.css"))?.content;
      if (!css) return;
      if (item.fonts?.length) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?${item.fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&")}&display=swap`;
        document.head.appendChild(link);
      }
      const style = document.createElement("style");
      style.dataset["zenginTheme"] = name;
      style.textContent = css;
      document.head.appendChild(style);
    })
    .catch(() => {
      // No registry here: the app shows as authored.
    });
}

export {};
