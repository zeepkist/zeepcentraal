import { expect, type Page, type Route, test } from '@playwright/test'

type ThemeSnapshot = {
	header: string
	mode: boolean
	sidebar: string
	warmNeutral900: string
	warmNeutral950: string
}

async function themeSnapshot(page: Page, mode: 'dark' | 'light') {
	return page.evaluate(
		({ expectedMode }) => {
			const header = document.querySelector<HTMLElement>('[data-testid="app-header"]')
			const sidebar = document.querySelector<HTMLElement>(
				'[data-testid="app-sidebar"] [data-slot="inner"]',
			)
			if (!header || !sidebar) throw new Error('Theme surfaces are missing')
			const root = getComputedStyle(document.documentElement)
			return {
				header: getComputedStyle(header).backgroundColor,
				mode: document.documentElement.classList.contains(expectedMode),
				sidebar: getComputedStyle(sidebar).backgroundColor,
				warmNeutral900: root.getPropertyValue('--color-warm-neutral-900').trim(),
				warmNeutral950: root.getPropertyValue('--color-warm-neutral-950').trim(),
			} satisfies ThemeSnapshot
		},
		{ expectedMode: mode },
	)
}

test('home shell renders', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Zeepkist stats hub' })).toBeVisible()
	await expect(page.getByRole('link', { name: /Steam/ })).toBeVisible()
})

test('theme button is available', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Theme' }).click()
})

test('stale browser session cannot override SSR authentication', async ({ page }) => {
	const hydrationWarnings: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'warning' && message.text().includes('Hydration')) {
			hydrationWarnings.push(message.text())
		}
	})
	await page.addInitScript(() => {
		localStorage.setItem(
			'zeepcentraal_session',
			JSON.stringify({ id: 1, steamId: '76561198000000000', steamName: 'Stale user' }),
		)
	})

	await page.goto('/')
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
	expect(hydrationWarnings).toEqual([])
})

test('failed OAuth callback reports verification failure and cleans the URL', async ({ page }) => {
	await page.goto('/?auth=callback')
	await expect(page.getByTestId('auth-verification-error')).toBeVisible()
	await expect(page).toHaveURL('/')
	await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('legacy OAuth callback redirects before rendering Vue', async ({ request }) => {
	const response = await request.get('/auth/callback', { maxRedirects: 0 })
	expect(response.status()).toBe(302)
	expect(response.headers().location).toBe('/?auth=callback')
})

test('brand colours remain stable through hydration', async ({ context, page }) => {
	const blockClientScripts = (route: Route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue()

	for (const mode of ['dark', 'light'] as const) {
		await context.addCookies([
			{ name: 'colour_mode', value: mode, url: 'http://127.0.0.1:4173' },
		])
		await page.route('**/*', blockClientScripts)
		await page.goto('/')
		const ssr = await themeSnapshot(page, mode)

		await page.unroute('**/*', blockClientScripts)
		await page.reload()
		await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
		const hydrated = await themeSnapshot(page, mode)

		expect(ssr).toEqual({
			header: 'rgba(23, 21, 19, 0.75)',
			mode: true,
			sidebar: 'rgb(23, 21, 19)',
			warmNeutral900: '#171513',
			warmNeutral950: '#0c0a09',
		})
		expect(hydrated).toEqual(ssr)
	}
})

for (const [path, heading] of [
	['/levels', 'Levels and leaderboards'],
	['/users', 'Users and stats'],
	['/adventure', 'Adventure leaderboards'],
	['/wiki', 'Zeepkist wiki'],
	['/developer', 'Developer portal'],
	['/developer/graphql', 'GraphQL guide'],
	['/super-league', 'ZSL results'],
] as const) {
	test(`${path} route renders`, async ({ page }) => {
		await page.goto(path)
		await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
	})
}

for (const path of ['/zsl', '/zsl/7', '/zsl/7/44', '/zsl/7/44/615'] as const) {
	test(`${path} legacy route is removed`, async ({ page }) => {
		const response = await page.goto(path)
		expect(response?.status()).toBe(404)
	})
}

test('personal records redirects logged-out players', async ({ page }) => {
	await page.goto('/records/me')
	await expect(page).toHaveURL('/records')
})

test('record detail placeholder is noindex', async ({ page }) => {
	await page.goto('/record/123')
	await expect(
		page.getByRole('heading', { name: 'Record details are coming next' }),
	).toBeVisible()
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		'content',
		'noindex, nofollow',
	)
})

test('global record history renders', async ({ page }) => {
	await page.goto('/records')
	await expect(
		page.getByRole('heading', { name: 'World records and personal bests' }),
	).toBeVisible()
	await expect(page.getByRole('tab', { name: 'Recent records' })).toBeVisible()
	await expect(page.getByLabel('Sort records')).toBeVisible()
})
test('dashboard prefetches deferred GraphQL before its section is visible', async ({ page }) => {
	const requests: Array<{ method: string; operation: string }> = []
	page.on('request', (request) => {
		if (request.method() !== 'POST') return
		const operation = /\bquery\s+(ZC_\w+)/.exec(request.postData() ?? '')?.[1]
		if (operation) requests.push({ method: request.method(), operation })
	})

	await page.goto('/')
	const target = page.locator('[data-prefetch="dashboard-statistics"]')
	await expect(target).toBeAttached()
	const targetTop = await target.evaluate(
		(element) => element.getBoundingClientRect().top + window.scrollY,
	)
	const viewportHeight = page.viewportSize()?.height ?? 720
	if (!requests.some(({ operation }) => operation === 'ZC_DashboardStatistics')) {
		await page.evaluate(
			({ top, height }) => window.scrollTo(0, Math.max(0, top - height * 1.5)),
			{ top: targetTop, height: viewportHeight },
		)
	}

	await expect
		.poll(() => requests.some(({ operation }) => operation === 'ZC_DashboardStatistics'))
		.toBe(true)
	const prefetchedBox = await target.boundingBox()
	expect(prefetchedBox?.y ?? 0).toBeGreaterThanOrEqual(viewportHeight)
	expect(requests.find(({ operation }) => operation === 'ZC_DashboardStatistics')?.method).toBe(
		'POST',
	)
})
