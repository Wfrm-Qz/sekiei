import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

/**
 * Sekiei の重要ジャーニーを実ブラウザで確認するための Playwright 設定。
 *
 * 正式版ページは `index.html` に統一しているため、E2E では preview サーバーではなく
 * dev server を立ち上げてルートページを直接確認する。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: isCi ? 1 : 0,
  workers: isCi ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    browserName: "chromium",
    ...(isCi ? {} : { channel: "msedge" }),
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
