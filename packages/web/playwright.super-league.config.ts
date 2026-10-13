import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: 'tests/super-league-redirect',
	testMatch: '*.e2e.ts',
	timeout: 90_000,
	workers: 1,
	webServer: [
		{
			command: 'bun tests/super-league-redirect/server.ts',
			url: 'http://127.0.0.1:4188/healthz',
			reuseExistingServer: false,
		},
		{
			command: 'bun --bun nuxt dev --host 127.0.0.1 --port 4187',
			// Compile SSR entry before tests; healthz does not warm Nuxt's route bundle.
			url: 'http://127.0.0.1:4187/super-league/vote?roundId=50',
			reuseExistingServer: false,
			timeout: 300_000,
			env: {
				NUXT_ENABLE_DEVTOOLS: 'false',
				NUXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:4188',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://127.0.0.1:4188/graphql',
			},
		},
	],
	use: {
		baseURL: 'http://127.0.0.1:4187',
		...devices['Desktop Chrome'],
		channel:
			process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined),
	},
})
