import { defineConfig } from "@playwright/test";

const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: ".",
  testMatch: ["playwright-ui.spec.cjs"],
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    viewport: { width: 1600, height: 1000 },
  },
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev -- --host 127.0.0.1 --port 4174",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: true,
        timeout: 120000,
      }
    : undefined,
});
