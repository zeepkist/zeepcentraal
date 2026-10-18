import { defineConfig, devices } from '@playwright/test'

const development = process.env.PLAYWRIGHT_HYDRATION_RUNTIME === 'development'
const channel =
	process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined)

export default defineConfig({
	testDir: 'tests',
	testMatch: ['upgrade/*.e2e.ts', 'e2e/*.e2e.ts'],
	timeout: 45_000,
	workers: 2,
	webServer: [
		{
			command: 'bun --no-env-file tests/upgrade/server.ts',
			url: 'http://127.0.0.1:4198/healthz',
			reuseExistingServer: false,
		},
		{
			command: development
				? 'bun --no-env-file --preload ./tests/upgrade/fetch.ts --bun nuxt dev --host 127.0.0.1 --port 4173'
				: 'bun --no-env-file --preload ./tests/upgrade/fetch.ts --bun .output/server/telemetry.mjs',
			url: 'http://127.0.0.1:4173/healthz',
			reuseExistingServer: false,
			timeout: 180_000,
			env: {
				NODE_ENV: development ? 'development' : 'production',
				NUXT_ENABLE_DEVTOOLS: 'false',
				NITRO_HOST: '127.0.0.1',
				NITRO_PORT: '4173',
				NUXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:4198',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://127.0.0.1:4198/graphql',
				NUXT_PUBLIC_GRAPHQL_WS_URL: 'ws://127.0.0.1:4198/graphql',
				NUXT_GITHUB_TOKEN: 'fake-fixture-github',
				NUXT_MODIO_API_KEY: 'fake-fixture-modio',
				NUXT_MODIO_API_ENDPOINT: 'http://127.0.0.1:4198/modio/',
				OTEL_SDK_DISABLED: 'true',
			},
		},
	],
	use: {
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		baseURL: 'http://127.0.0.1:4173',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } },
		{
			name: 'firefox',
			testMatch: '**/upgrade/hydration.e2e.ts',
			use: { ...devices['Desktop Firefox'] },
		},
		{ name: 'mobile', use: { ...devices['Pixel 7'], channel } },
	],
})
