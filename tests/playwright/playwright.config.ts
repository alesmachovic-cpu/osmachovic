import { defineConfig, devices } from "@playwright/test";

/**
 * Konfigurácia pre VIANEMA UX walker.
 *
 * BASE_URL nastavuje GitHub Actions na https://dev.amgd.sk (alebo override
 * cez secret PLAYWRIGHT_BASE_URL).
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "https://dev.amgd.sk",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
