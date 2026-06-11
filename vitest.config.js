import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.js"],
  },
});
