import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', workers: 1, reporter: 'list', timeout: 60000,
  outputDir: '../../test-results/talent-ui',
  use: { baseURL: 'http://127.0.0.1:5182', headless: true, channel: process.env.REVIEW_TEST_BROWSER || 'msedge', viewport: { width: 1440, height: 1100 } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --config tests/talent-ui/vite.config.mjs', cwd: process.cwd(), url: 'http://127.0.0.1:5182/tests/talent-ui/index.html', reuseExistingServer: false, timeout: 120000 },
});
