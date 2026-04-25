import { defineConfig } from "vitest/config";

/**
 * Sekiei の unit / integration test 向け Vitest 設定。
 *
 * 画面 entry の巨大 DOM 初期化を直接走らせるのではなく、まずは
 * 純粋関数と jsdom で扱える UI helper を安定して検証できる土台を用意する。
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "tests/e2e/**",
        "tests/**",
        "playwright.config.ts",
        "vitest.config.ts",
      ],
    },
  },
});
