import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "app/lib/**/*.ts",
      ],
      exclude: [
        "app/**/*.test.ts",
        "app/**/types.ts",
      ],
    },
  },
});