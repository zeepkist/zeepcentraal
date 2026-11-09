import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: 'lobby.e2e.ts',
	outputDir: '../../.data/lobby-playwright',
	workers: 3,
	timeout: 90_000,
	expect: { timeout: 20_000 },
	use: {
		baseURL: process.env.ZC_LOBBY_WEB_URL ?? 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
	],
})
