import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: 'static-metrics.e2e.ts',
	workers: 1,
	timeout: 90_000,
	webServer: [
		{
			command: 'bun --no-env-file ../postgraphile/scripts/verifyGlobalMetrics.ts --serve',
			url: 'http://127.0.0.1:55440/healthz',
			timeout: 120_000,
		},
		{
			command:
				process.env.ZC_METRICS_PRODUCTION === '1'
					? 'bun --bun .output/server/telemetry.mjs'
					: process.env.ZC_METRICS_ISOLATED === '1'
						? 'bun --bun nuxt dev ../../.data/metrics-web-check --host 127.0.0.1 --port 4174'
						: 'bun --bun run dev --host 127.0.0.1 --port 4174',
			url: 'http://127.0.0.1:4174/healthz',
			timeout: 180_000,
			env: {
				NITRO_HOST: '127.0.0.1',
				NITRO_PORT: '4174',
				OTEL_SDK_DISABLED: 'true',
				NUXT_PUBLIC_GRAPHQL_HTTP_URL: 'http://127.0.0.1:55440/',
				NUXT_PUBLIC_GRAPHQL_WS_URL: 'ws://127.0.0.1:55440/',
				NUXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:55440',
			},
		},
	],
	use: { baseURL: 'http://127.0.0.1:4174' },
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				channel: process.platform === 'win32' ? 'chrome' : undefined,
			},
		},
	],
})
