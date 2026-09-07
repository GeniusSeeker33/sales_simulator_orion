import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'*.spec.mjs',workers:1,reporter:'list',
 outputDir:'../../test-results/reviewer-ui',
 use:{baseURL:'http://127.0.0.1:5179',headless:true,channel:process.env.REVIEW_TEST_BROWSER || 'msedge',viewport:{width:1440,height:1100}},
 webServer:{command:'npx vite --config tests/reviewer-ui/vite.config.mjs',cwd:process.cwd(),url:'http://127.0.0.1:5179/tests/reviewer-ui/index.html',reuseExistingServer:!process.env.CI},
});
