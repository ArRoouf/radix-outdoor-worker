import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',fullyParallel:false,workers:1,
 use:{baseURL:'http://127.0.0.1:4174',trace:'retain-on-failure'},
 projects:[{name:'mobile-chromium',use:{...devices['Pixel 7']}}],
 webServer:{command:'node scripts/e2e-server.mjs',url:'http://127.0.0.1:4174/api/v1/health',reuseExistingServer:false,timeout:90000},
});
