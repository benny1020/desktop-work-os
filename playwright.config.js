import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5178",
    viewport: { width: 1440, height: 900 },
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "artifacts/test-report" }],
  ],
  webServer: {
    command: "npm run dev -- --port 5178",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: true,
  },
});
