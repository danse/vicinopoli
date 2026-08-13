import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8080",
  },
  webServer: {
    command: "docker compose up -d --build",
    url: "http://localhost:8080/api/health",
    reuseExistingServer: !process.env.CI,
    cwd: "..",
    timeout: 300_000,
  },
});
