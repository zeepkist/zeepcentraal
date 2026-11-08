import { defineConfig, devices } from '@playwright/test'

process.env.ADVENTURE_BROWSER_FIXTURE = '1'

const development = process.env.PLAYWRIGHT_HYDRATION_RUNTIME !== 'production'
const channel =
	process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined)
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: 'adventure.e2e.ts',
	timeout: 60_000,
	workers: 1,
	webServer: [
		{
			command: 'bun ../postgraphile/scripts/verifyAdventureLeaderboards.ts --seed --serve',
			url: 'http://127.0.0.1:55440/healthz',
			reuseExistingServer: !process.env.CI,
		},
		{
			command: development
				? 'bun --bun nuxt dev --extends ./tests/motion-layer --host 127.0.0.1 --port 4173'
				: 'bun --bun .output/server/telemetry.mjs',
			url: development ? 'http://127.0.0.1:4173/adventure' : 'http://127.0.0.1:4173/healthz',
			reuseExistingServer: false,
			timeout: 300_000,
			env: {
				NUXT_ENABLE_DEVTOOLS: 'false',
				NODE_ENV: development ? 'development' : 'production',
				NUXT_APP_SECRET: 'fake-adventure-browser-secret-at-least-32-characters',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://127.0.0.1:55440/',
				NUXT_PUBLIC_GRAPHQL_WS_URL: 'ws://127.0.0.1:55440/',
				NITRO_HOST: '127.0.0.1',
				NITRO_PORT: '4173',
				OTEL_SDK_DISABLED: 'true',
			},
		},
	],
	use: {
		baseURL: 'http://127.0.0.1:4173',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } },
		{ name: 'mobile', use: { ...devices['Pixel 7'], channel } },
	],
})
