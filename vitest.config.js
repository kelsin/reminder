import process from "node:process";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      include: ["src/**"],
      reporter: process.env.CI ? "clover" : ["text-summary", "html"],
    },
    dir: "src",
    globals: true,
    outputFile: "./junit.xml",
    reporters: process.env.CI ? ["junit", "default"] : "default",
  },
});
