const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: {timeout: 15_000},
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: {width: 1440, height: 1000},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  }
});
