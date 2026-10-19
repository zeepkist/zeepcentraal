import { defineConfig, devices } from '@playwright/test'
import upgrade from './playwright.upgrade.config'

const channel =
	process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined)

export default defineConfig({
	...upgrade,
	timeout: 120_000,
	expect: { timeout: 15_000 },
	testMatch: ['e2e/motion*.e2e.ts', 'e2e/shared-view-transition.e2e.ts'],
	webServer: Array.isArray(upgrade.webServer)
		? upgrade.webServer.map((server) =>
				server.command?.includes('nuxt dev')
					? {
							...server,
							command: `${server.command} --extends ./tests/motion-layer`,
							timeout: 300_000,
							env: { ...server.env, NUXT_IGNORE_LOCK: '1' },
						}
					: server,
			)
		: upgrade.webServer,
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{
			name: 'webkit',
			use: {
				...devices['Desktop Safari'],
				launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
					? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
					: undefined,
			},
		},
		{ name: 'mobile', use: { ...devices['Pixel 7'], channel } },
	],
})
