import { expect, type Page } from '@playwright/test'
import { version } from 'vue'
import { ghostPlaybackLzma } from '../fixtures/ghostPlayback'
import { test } from '../support/browser'

async function waitForHydration(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

test('portable handlers preserve statuses, cookies, and origin checks over HTTP', async ({
	request,
}) => {
	const session = await request.get('/api/session')
	expect(session.status()).toBe(200)
	expect(session.headers()['cache-control']).toBe('private, no-store')
	expect(await session.json()).toEqual({ user: null, isAdmin: false, refreshAt: null })
	const refresh = await request.post('/api/auth/refresh')
	expect(refresh.status()).toBe(200)
	expect(
		refresh.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie'),
	).toHaveLength(3)
	const logout = await request.post('/api/auth/logout')
	expect(logout.status()).toBe(204)
	expect(await logout.text()).toBe('')
	expect(
		logout.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie'),
	).toHaveLength(4)
	const crossSite = await request.post('/api/auth/logout', {
		headers: { origin: 'https://other.example.test' },
	})
	expect(crossSite.status()).toBe(403)
	expect((await crossSite.json()).statusCode).toBe(403)
	const invalid = await request.get('/api/super-league/vote-results?roundId=0')
	expect(invalid.status()).toBe(400)
	const unavailable = await request.get('/api/super-league/vote-results?roundId=50')
	expect(unavailable.status()).toBe(404)
	const retried = await request.post('/api/discord/link-code', {
		headers: {
			cookie: 'zeepcentral_steam_id=76561198000000000; zeepcentral_access_token=old; zeepcentral_refresh_token=old-refresh',
		},
	})
	expect(retried.status()).toBe(200)
	expect((await retried.json()).code).toBe('FAKE-CODE')
	expect(
		retried.headersArray().filter(({ name }) => name.toLowerCase() === 'set-cookie'),
	).toHaveLength(3)
	const download = await request.get('/api/tournaments/playlist?type=0')
	expect(download.status()).toBe(200)
	expect(download.headers()['content-type']).toContain('application/json')
	expect(download.headers()['content-disposition']).toBe(
		'attachment; filename="zeepcentraal-totw-all.zeeplist"',
	)
	expect(download.headers()['x-content-type-options']).toBe('nosniff')
	expect((await download.json()).levels[0].UID).toBe('fixture-level')
	const redirect = await request.get('/api/downloads/modkist/stable/msi', { maxRedirects: 0 })
	expect(redirect.status()).toBe(302)
	expect(redirect.headers().location).toBe('https://github.com/Thundernerd/ModkistMKII/releases')
	expect((await request.get('/api/downloads/modkist/stable/unknown')).status()).toBe(404)
})

test('early 404, canonical redirects, and sitemap routes survive production build', async ({
	request,
}) => {
	expect((await request.get('/healthz')).status()).toBe(200)
	expect((await request.head('/healthz')).status()).toBe(200)
	for (const path of ['/missing-nuxt-upgrade-page', '/Support']) {
		const response = await request.get(path)
		expect(response.status()).toBe(404)
		const html = await response.text()
		expect(html).toContain('<!DOCTYPE html>')
		expect(html).toContain('Page error')
		expect(html).toContain('Return home')
	}
	for (const [path, target] of [
		['/totd', '/totw'],
		['/adventure', '/adventure/a'],
	] as const) {
		const response = await request.get(path, { maxRedirects: 0 })
		expect(response.status()).toBe(301)
		expect(response.headers().location).toBe(target)
	}
	const sitemap = await request.get('/sitemaps/records/0.xml')
	expect(sitemap.status()).toBe(200)
	expect(sitemap.headers()['content-type']).toContain('application/xml')
	expect(await sitemap.text()).toContain('<urlset')
	expect(sitemap.headers()['cache-control']).toBe('s-maxage=600, stale-while-revalidate')
})

test('Pages hydrate with translated controls and working Nuxt UI events', async ({ page }) => {
	test.setTimeout(90_000)
	await page.route('https://ko-fi.com/**', (route) =>
		route.fulfill({ contentType: 'text/html', body: '<p>Fixture</p>' }),
	)
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	page.on('console', (message) => {
		if (
			/hydration.*mismatch|globalProperties.*not supported|Nuxt instance is unavailable/i.test(
				message.text(),
			)
		)
			errors.push(message.text())
	})
	await page.goto('/support')
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Support')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	const runtimeVersion = await page.evaluate(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { version: string }
		}
		return root.__vue_app__?.version
	})
	expect(runtimeVersion).toBe(version)
	expect(runtimeVersion).toMatch(/^\d+\.\d+\.\d+$/)
	const theme = page.getByTestId('app-header').getByRole('button', { name: /theme/i })
	const before = (await page.locator('html').getAttribute('class')) ?? ''
	await theme.click()
	await expect(page.locator('html')).not.toHaveAttribute('class', before)
	await page.getByRole('button', { name: 'Language', exact: true }).click()
	const english = page.getByRole('menuitemcheckbox', { name: 'English', exact: true })
	await expect(english).toBeChecked()
	await english.click()
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(
		page.getByRole('menuitem', { name: 'Sign in with Steam', exact: true }),
	).toBeVisible()
	await expect(
		page.getByRole('menuitem', { name: 'Sign in with Discord', exact: true }),
	).toBeVisible()
	await page.keyboard.press('Escape')
	if ((page.viewportSize()?.width ?? 0) >= 1024) {
		await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).hover()
		await expect(
			page.locator('[data-slot="text"]').filter({ hasText: /^Collapse sidebar$/ }),
		).toBeVisible()
	}
	await page.goto('/wiki')
	await waitForHydration(page)
	const wikiError = await page.evaluate(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: { $nuxt?: { payload: { error?: { message?: string } } } }
				}
			}
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.payload.error?.message
	})
	expect(wikiError).toBeUndefined()
	await expect(page.getByRole('heading', { level: 1, name: 'Zeepkist Wiki' })).toBeVisible()
	await expect(page.locator('body')).not.toContainText('pages.wiki.')
	await page.locator('a[href="/wiki/getting-started"]').first().click()
	await expect(page).toHaveURL('/wiki/getting-started')
	await expect(page.getByRole('heading', { level: 1, name: 'Getting Started' })).toBeVisible()
	// SSR headings can appear before entry imports finish after a full navigation.
	await waitForHydration(page)
	await page.goto('/developer/graphql')
	await expect(
		page.getByRole('heading', { level: 1, name: 'ZeepCentraal GraphQL API' }),
	).toBeVisible()
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	await page.getByRole('button', { name: 'Send a request', exact: true }).click()
	await expect(page.getByRole('tab', { name: 'Send with curl', exact: true })).toBeVisible()
	await page.getByRole('tab', { name: 'Send with TypeScript', exact: true }).click()
	await expect(
		page.getByRole('tab', { name: 'Send with TypeScript', exact: true }),
	).toHaveAttribute('aria-selected', 'true')
	expect(errors).toEqual([])
})

async function mockReplayVerification(page: Page) {
	await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
		route.fulfill({
			contentType: 'application/javascript',
			body: `window.turnstile = { render(element, options) {
 const button = document.createElement('button')
 button.textContent = 'Verify fixture replay'
 button.onclick = () => options.callback('fake-fixture-token')
 element.append(button)
 return 'fixture'
}, remove() {}, reset() {} }`,
		}),
	)
}

test('Replay activates after verification and handles missing ghost data', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await mockReplayVerification(page)
	await page.goto('/record/9001')
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	await page.evaluate(() =>
		document.getElementById('replay-heading')?.scrollIntoView({ block: 'center' }),
	)
	await expect(page.getByRole('button', { name: 'Verify fixture replay' })).toBeVisible({
		timeout: 15_000,
	})
	await expect(page.locator('.ghost-replay-workspace')).toHaveCount(0)
	await page.getByRole('button', { name: 'Verify fixture replay' }).click()
	// Development may optimize the lazy Three.js viewer on first verification.
	await expect(page.locator('.ghost-replay-workspace')).toBeVisible({ timeout: 15_000 })
	await expect(page.getByText('No playable ghost', { exact: true })).toBeVisible()
	expect(errors).toEqual([])
})

test('Replay renders worker-transferred protobuf defaults without NaN geometry', async ({
	page,
}) => {
	const geometryErrors: string[] = []
	page.on('console', (message) => {
		// Three.js PMREM remains unmodified; permit its ANGLE precision warnings.
		const precisionOnly = message
			.text()
			.split('\n')
			.every((line) => !line.trim() || line.includes('warning X4122:'))
		if (
			(message.type() === 'error' && message.text().startsWith('THREE.')) ||
			(message.text().startsWith('THREE.WebGLProgram:') && !precisionOnly)
		)
			geometryErrors.push(message.text())
	})
	await mockReplayVerification(page)
	await page.route('https://cdn.zeepki.st/fixtures/worker-zeros.ghost', (route) =>
		route.fulfill({ contentType: 'application/octet-stream', body: ghostPlaybackLzma }),
	)
	await page.goto('/record/9002')
	await waitForHydration(page)
	await page.getByRole('button', { name: 'Verify fixture replay' }).click()
	const viewer = page.locator('.ghost-viewer')
	await expect(viewer.locator('canvas')).toBeVisible({ timeout: 15_000 })
	const timeline = page.getByRole('slider', { name: 'Replay position' })
	await expect(timeline).toHaveAttribute('max', '42')
	await page.getByRole('button', { name: 'Play replay', exact: true }).click()
	await expect.poll(async () => Number(await timeline.inputValue())).toBeGreaterThan(0)
	await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
	await timeline.fill('21')
	await expect(timeline).toHaveValue('21')
	await page.getByRole('button', { name: 'Isometric', exact: true }).click()
	await page.getByRole('button', { name: 'Orbit', exact: true }).click()
	await page.getByRole('button', { name: 'Ghost playback settings', exact: true }).click()
	const trails = page.getByRole('switch', { name: 'Ghost trails', exact: true })
	await expect(trails).toBeChecked()
	await trails.click()
	await expect(trails).not.toBeChecked()
	await trails.click()
	await expect(trails).toBeChecked()
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: 'Frame full route', exact: true }).click()
	await expect(viewer.locator('canvas')).toBeVisible()
	await page.getByRole('tab', { name: 'Advanced Telemetry', exact: true }).click()
	const line = page.getByRole('tabpanel').locator('.v-charts-line path').first()
	await expect(page.getByRole('tabpanel').locator('svg').first()).toBeVisible({ timeout: 15_000 })
	await expect(line).toBeAttached()
	await expect(line).toHaveAttribute('d', /[MLC]/)
	expect(await line.getAttribute('d')).not.toContain('NaN')
	expect(geometryErrors).toEqual([])
})
