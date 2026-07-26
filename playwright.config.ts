import { defineConfig, devices } from '@playwright/test';

// E2E runs against the real Workers runtime (wrangler dev) on a seeded local
// D1/R2 — the same stack production uses. Chromium desktop + WebKit mobile:
// the iPhone-on-WhatsApp reality (spec §4.14).
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.spec.ts',
	timeout: 45_000,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// One shared local D1 → serial execution keeps specs deterministic
	workers: 1,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: 'http://localhost:8787',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'npm run e2e:server',
		port: 8787,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile-safari', use: { ...devices['iPhone 13'] } }
	]
});
