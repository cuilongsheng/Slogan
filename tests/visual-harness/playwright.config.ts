import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'voice.spec.ts',
  use: {
    baseURL: 'http://localhost:8094',
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  webServer: {
    command:
      'pnpm --filter @slogan/admin exec vite --config ../../tests/visual-harness/vite.config.mjs',
    url: 'http://localhost:8094',
    reuseExistingServer: false,
  },
});
