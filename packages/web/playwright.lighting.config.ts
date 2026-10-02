import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: 'tests/lighting',
	testMatch: '*.e2e.ts',
	timeout: 300_000,
	workers: 1,
	webServer: {
		command: 'bun tests/lighting/server.ts',
		url: 'http://127.0.0.1:4185',
		reuseExistingServer: false,
		timeout: 60_000,
	},
	use: {
		baseURL: 'http://127.0.0.1:4185',
		...devices['Desktop Chrome'],
		channel:
			process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined),
		viewport: { width: 640, height: 360 },
		launchOptions: {
			args:
				process.env.GHOST_LIGHTING_GPU === '1'
					? ['--enable-webgl']
					: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
		},
	},
})
