import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @slogan/admin dev',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @slogan/mobile exec expo start --web --port 8082',
      env: {
        CI: '1',
        EXPO_NO_DOTENV: '1',
        EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'browser-test.apps.googleusercontent.com',
      },
      url: 'http://localhost:8082',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
