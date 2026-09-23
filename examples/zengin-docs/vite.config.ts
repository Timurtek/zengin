import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Every page is a path now (`/rules/`, `/config-reference/`), and in dev none of those is a file on disk.
 * The built site has a real HTML file at each one; this makes the dev server agree rather than answering 404.
 */
function pageFallback(): Plugin {
  return {
    name: "zengin-docs-page-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (path.endsWith("/") && path !== "/" && !path.startsWith("/@") && !path.startsWith("/node_modules")) req.url = "/index.html";
        next();
      });
    },
  };
}

export default defineConfig({ plugins: [react(), pageFallback()], server: { port: 5181, strictPort: true } });
