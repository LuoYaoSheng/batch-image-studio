import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["playwright-ui.spec.cjs"],
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    viewport: { width: 1600, height: 1000 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
