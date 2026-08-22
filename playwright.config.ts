import { defineConfig } from "@playwright/test";

/**
 * E2E tests run against the PGlite fallback database — no external services.
 * The webServer command seeds a fresh demo database (last week closed with a
 * pending winner spin, this week live) and then starts next dev.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1, // shared database state; the flows are sequential
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3105",
    browserName: "chromium",
    // Mobile-first: test at a typical phone size with touch.
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command:
      "pnpm tsx scripts/seed-demo.ts && pnpm next dev -p 3105",
    url: "http://localhost:3105/welcome",
    env: { DATABASE_URL: "pglite://.data/e2e" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
