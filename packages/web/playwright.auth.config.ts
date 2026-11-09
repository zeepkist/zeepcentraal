import { defineConfig, devices } from '@playwright/test'

const development = process.env.PLAYWRIGHT_HYDRATION_RUNTIME === 'development'
const databaseUrl = process.env.WEB_AUTH_TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Run auth browser tests through tests/auth/run.ts')

export default defineConfig({
	testDir: 'tests/auth',
	testMatch: '*.e2e.ts',
	workers: 1,
	timeout: 60_000,
	webServer: [
		{
			command: 'bun --no-env-file tests/upgrade/server.ts',
			url: 'http://127.0.0.1:4198/healthz',
			reuseExistingServer: false,
		},
		{
			command: 'bun --no-env-file tests/auth/server.ts',
			url: 'http://127.0.0.1:4199/healthz',
			reuseExistingServer: false,
			env: { WEB_AUTH_TEST_DATABASE_URL: databaseUrl },
		},
		{
			command: development
				? 'bun --no-env-file --preload ./tests/upgrade/fetch.ts --bun nuxt dev --extends ./tests/motion-layer --host 127.0.0.1 --port 4173'
				: 'bun --no-env-file --preload ./tests/upgrade/fetch.ts --bun .output/server/telemetry.mjs',
			url: development ? 'http://127.0.0.1:4173/terms' : 'http://127.0.0.1:4173/healthz',
			reuseExistingServer: false,
			timeout: 300_000,
			env: {
				NODE_ENV: development ? 'development' : 'production',
				DATABASE_URL: databaseUrl,
				NUXT_APP_SECRET: 'fake-auth-test-secret-at-least-32-characters',
				NUXT_ENABLE_DEVTOOLS: 'false',
				NITRO_HOST: '127.0.0.1',
				NITRO_PORT: '4173',
				NUXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:4199',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://127.0.0.1:4198/graphql',
				NUXT_PUBLIC_GRAPHQL_WS_URL: 'ws://127.0.0.1:4198/graphql',
				NUXT_GITHUB_TOKEN: 'fake-fixture-github',
				NUXT_MODIO_API_KEY: 'fake-fixture-modio',
				NUXT_MODIO_API_ENDPOINT: 'http://127.0.0.1:4198/modio/',
				OTEL_SDK_DISABLED: 'true',
			},
		},
	],
	use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				channel: process.platform === 'win32' ? 'chrome' : undefined,
			},
		},
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	],
})
