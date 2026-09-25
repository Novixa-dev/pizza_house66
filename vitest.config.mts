import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Integration tests talk to a real database, so DATABASE_URL has to be in the
// environment before Prisma is constructed. Unit tests don't need it and run
// fine either way.
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // See the stub for why this is safe.
      "server-only": path.resolve(import.meta.dirname, "./tests/support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one restaurant's data and its slot capacity, so
    // they must not race each other.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
