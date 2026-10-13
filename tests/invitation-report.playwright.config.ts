import { defineConfig } from '@playwright/test';
process.env.SLOGAN_MOBILE_E2E_ORIGIN = 'http://localhost:8108';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'mobile-invitation-report.e2e.spec.ts',
  workers: 1,
  use: { viewport: { width: 390, height: 844 }, locale: 'zh-CN', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @slogan/mobile exec expo start --web --port 8108',
    url: 'http://localhost:8108',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { CI: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000' },
  },
});
