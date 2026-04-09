import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: workspaceRoot,
  resolve: {
    alias: {
      "bun:test": fileURLToPath(new URL("./tools/testing/bun-test-shim.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["packages/**/*.{test,spec}.ts"],
  },
});
