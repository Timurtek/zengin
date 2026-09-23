import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * The hosted site serves a directory at its trailing slash (/storybook/, /templates/<name>/), and the
 * links say so, since Storybook and the previews load their assets relative to the page. Vite's dev
 * server serves public/ file by file and would answer those URLs with the site's own index. This makes
 * dev agree with the host: a directory URL under public/ that has an index.html is that file.
 */
function directoryIndex(): Plugin {
  return {
    name: "zengin-directory-index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        const path = url.split("?")[0];
        if (path.endsWith("/") && path !== "/" && existsSync(join(server.config.publicDir, path, "index.html"))) {
          req.url = `${path}index.html${url.slice(path.length)}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), directoryIndex()],
  server: { port: 5174, strictPort: true },
  // Two entries, two URLs. /why/ is its own page so it can carry its own title, description and canonical;
  // an anchor on the home page cannot, and the argument is the half a search or a shared link lands on.
  build: { rollupOptions: { input: { main: resolve(__dirname, "index.html"), why: resolve(__dirname, "why/index.html") } } },
});
