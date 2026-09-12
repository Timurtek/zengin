import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests resolve the engine from source so they do not depend on a prior build.
export default defineConfig({
  resolve: {
    alias: { "@zengin/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)) },
  },
  test: { include: ["test/**/*.test.ts"] },
});
