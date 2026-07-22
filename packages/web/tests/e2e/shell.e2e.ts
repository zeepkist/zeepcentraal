import { expect, type Page, type Route, test } from '@playwright/test'

const themeTokenNames = [
	'--color-warm-neutral-50',
	'--color-warm-neutral-100',
	'--color-warm-neutral-200',
	'--color-warm-neutral-300',
	'--color-warm-neutral-400',
	'--color-warm-neutral-500',
	'--color-warm-neutral-600',
	'--color-warm-neutral-700',
	'--color-warm-neutral-800',
	'--color-warm-neutral-900',
	'--color-warm-neutral-950',
	'--background',
	'--foreground',
	'--card',
	'--card-foreground',
	'--primary',
	'--primary-foreground',
	'--secondary',
	'--secondary-foreground',
	'--muted',
	'--muted-foreground',
	'--accent',
	'--accent-foreground',
	'--border',
	'--ring',
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--ui-primary',
	'--ui-secondary',
	'--ui-success',
	'--ui-info',
	'--ui-warning',
	'--ui-error',
	'--ui-bg',
	'--ui-bg-muted',
	'--ui-bg-elevated',
	'--ui-bg-accented',
	'--ui-bg-inverted',
	'--ui-border',
	'--ui-border-muted',
	'--ui-border-accented',
	'--ui-border-inverted',
	'--ui-text-dimmed',
	'--ui-text-muted',
	'--ui-text-toned',
	'--ui-text',
	'--ui-text-highlighted',
	'--ui-text-inverted',
] as const

type ThemeTokenName = (typeof themeTokenNames)[number]

type ThemeSnapshot = {
	mode: boolean
	tokens: Record<ThemeTokenName, string>
	utilities: Record<string, string>
}

const expectedThemeTokens: Record<'dark' | 'light', Record<ThemeTokenName, string>> = {
	dark: {
		'--color-warm-neutral-50': '#fafaf9',
		'--color-warm-neutral-100': '#f5f5f4',
		'--color-warm-neutral-200': '#e7e5e4',
		'--color-warm-neutral-300': '#d6d3d1',
		'--color-warm-neutral-400': '#a8a29e',
		'--color-warm-neutral-500': '#78716c',
		'--color-warm-neutral-600': '#57534e',
		'--color-warm-neutral-700': '#44403c',
		'--color-warm-neutral-800': '#292524',
		'--color-warm-neutral-900': '#171513',
		'--color-warm-neutral-950': '#0c0a09',
		'--background': '#0c0a09',
		'--foreground': 'oklch(96% 0 0)',
		'--card': '#171513',
		'--card-foreground': 'oklch(96% 0 0)',
		'--primary': '#facc15',
		'--primary-foreground': 'oklch(13% 0 0)',
		'--secondary': '#292524',
		'--secondary-foreground': 'oklch(96% 0 0)',
		'--muted': '#292524',
		'--muted-foreground': 'oklch(72% 0 0)',
		'--accent': '#292524',
		'--accent-foreground': 'oklch(96% 0 0)',
		'--border': '#292524',
		'--ring': '#facc15',
		'--chart-1': '#facc15',
		'--chart-2': '#22c55e',
		'--chart-3': '#14b8a6',
		'--chart-4': 'oklch(46% 0 0)',
		'--chart-5': '#f97316',
		'--ui-primary': '#facc15',
		'--ui-secondary': '#292524',
		'--ui-success': '#22c55e',
		'--ui-info': '#14b8a6',
		'--ui-warning': '#f97316',
		'--ui-error': '#f87171',
		'--ui-bg': '#0c0a09',
		'--ui-bg-muted': '#171513',
		'--ui-bg-elevated': '#171513',
		'--ui-bg-accented': '#292524',
		'--ui-bg-inverted': '#facc15',
		'--ui-border': '#292524',
		'--ui-border-muted': '#292524',
		'--ui-border-accented': '#292524',
		'--ui-border-inverted': '#facc15',
		'--ui-text-dimmed': '#78716c',
		'--ui-text-muted': '#a8a29e',
		'--ui-text-toned': '#d6d3d1',
		'--ui-text': '#e7e5e4',
		'--ui-text-highlighted': '#fafaf9',
		'--ui-text-inverted': '#0c0a09',
	},
	light: {
		'--color-warm-neutral-50': '#1c1917',
		'--color-warm-neutral-100': '#292524',
		'--color-warm-neutral-200': '#44403c',
		'--color-warm-neutral-300': '#57534e',
		'--color-warm-neutral-400': '#78716c',
		'--color-warm-neutral-500': '#a8a29e',
		'--color-warm-neutral-600': '#d6d3d1',
		'--color-warm-neutral-700': '#e7e5e4',
		'--color-warm-neutral-800': '#f1efeb',
		'--color-warm-neutral-900': '#faf9f7',
		'--color-warm-neutral-950': '#ffffff',
		'--background': '#f4f1eb',
		'--foreground': '#292524',
		'--card': '#ffffff',
		'--card-foreground': '#292524',
		'--primary': '#b77900',
		'--primary-foreground': '#1c1917',
		'--secondary': '#e7e2da',
		'--secondary-foreground': '#292524',
		'--muted': '#ece8e1',
		'--muted-foreground': '#6b625b',
		'--accent': '#fef3c7',
		'--accent-foreground': '#422006',
		'--border': '#d8d1c7',
		'--ring': '#b77900',
		'--chart-1': '#b77900',
		'--chart-2': '#15803d',
		'--chart-3': '#0f766e',
		'--chart-4': '#7c3aed',
		'--chart-5': '#c2410c',
		'--ui-primary': '#b77900',
		'--ui-secondary': '#57534e',
		'--ui-success': '#15803d',
		'--ui-info': '#0f766e',
		'--ui-warning': '#c2410c',
		'--ui-error': '#dc2626',
		'--ui-bg': '#ffffff',
		'--ui-bg-muted': '#f7f5f1',
		'--ui-bg-elevated': '#ffffff',
		'--ui-bg-accented': '#ece8e1',
		'--ui-bg-inverted': '#292524',
		'--ui-border': '#e2ddd5',
		'--ui-border-muted': '#ece8e1',
		'--ui-border-accented': '#cfc7bc',
		'--ui-border-inverted': '#292524',
		'--ui-text-dimmed': '#8a8179',
		'--ui-text-muted': '#6b625b',
		'--ui-text-toned': '#4f4842',
		'--ui-text': '#3b3632',
		'--ui-text-highlighted': '#1c1917',
		'--ui-text-inverted': '#ffffff',
	},
}

async function themeSnapshot(page: Page, mode: 'dark' | 'light') {
	return page.evaluate(
		({ expectedMode, tokenNames }) => {
			const root = getComputedStyle(document.documentElement)
			const tokens = Object.fromEntries(
				tokenNames.map((token) => [token, root.getPropertyValue(token).trim()]),
			) as Record<ThemeTokenName, string>
			const utilityClasses = {
				applicationBackground: 'bg-background',
				applicationCard: 'bg-card',
				applicationForeground: 'text-foreground',
				applicationBorder: 'border border-border',
				nuxtUiDefault: 'bg-default',
				nuxtUiMuted: 'bg-muted',
				nuxtUiElevated: 'bg-elevated',
				nuxtUiAccented: 'bg-accented',
				nuxtUiText: 'text-default',
				nuxtUiBorder: 'border border-default',
			}
			const utilities = Object.fromEntries(
				Object.entries(utilityClasses).map(([name, classes]) => {
					const element = document.createElement('div')
					element.className = classes
					document.body.append(element)
					const style = getComputedStyle(element)
					const value = classes.includes('bg-')
						? style.backgroundColor
						: classes.includes('text-')
							? style.color
							: style.borderTopColor
					element.remove()
					return [name, value]
				}),
			)
			return {
				mode: document.documentElement.classList.contains(expectedMode),
				tokens,
				utilities,
			} satisfies ThemeSnapshot
		},
		{ expectedMode: mode, tokenNames: themeTokenNames },
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
	test.slow()
	const blockClientScripts = (route: Route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue()

	for (const mode of ['dark', 'light'] as const) {
		await context.addCookies([
			{ name: 'colour_mode', value: mode, url: 'http://127.0.0.1:4173' },
			{ name: 'i18n_redirected', value: 'en', url: 'http://127.0.0.1:4173' },
		])
		const rawResponse = await context.request.get('http://127.0.0.1:4173/')
		expect(await rawResponse.text()).toMatch(new RegExp(`<html[^>]*class="${mode}"`))

		await page.route('**/*', blockClientScripts)
		await page.goto('/')
		const ssr = await themeSnapshot(page, mode)

		await page.unroute('**/*', blockClientScripts)
		await page.reload()
		await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
		await page.waitForTimeout(4_000)
		const hydrated = await themeSnapshot(page, mode)

		expect(ssr.mode).toBe(true)
		expect(ssr.tokens).toEqual(expectedThemeTokens[mode])
		expect(hydrated).toEqual(ssr)
	}
})

test('missing colour preference renders dark fallback before scripts', async ({
	context,
	page,
}) => {
	await context.clearCookies()
	await context.addCookies([
		{ name: 'i18n_redirected', value: 'en', url: 'http://127.0.0.1:4173' },
	])
	const response = await context.request.get('http://127.0.0.1:4173/')
	expect(await response.text()).toMatch(/<html[^>]*class="dark"/)

	await page.route('**/*', (route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue(),
	)
	await page.goto('/')
	const snapshot = await themeSnapshot(page, 'dark')
	expect(snapshot.mode).toBe(true)
	expect(snapshot.tokens).toEqual(expectedThemeTokens.dark)
})

test('theme toggle switches application and Nuxt UI tokens together', async ({ context, page }) => {
	await context.addCookies([
		{ name: 'colour_mode', value: 'dark', url: 'http://127.0.0.1:4173' },
		{ name: 'i18n_redirected', value: 'en', url: 'http://127.0.0.1:4173' },
	])
	await page.goto('/')
	await page.waitForFunction(() => '__vue_app__' in (document.querySelector('#__nuxt') ?? {}))
	await page.getByRole('button', { name: 'Theme' }).click()
	await expect(page.locator('html')).toHaveClass(/light/)

	const snapshot = await themeSnapshot(page, 'light')
	expect(snapshot.tokens).toEqual(expectedThemeTokens.light)
})

test('collapsed sidebar remains stable through hydration', async ({ context, page }) => {
	const hydrationWarnings: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'warning' && message.text().includes('Hydration')) {
			hydrationWarnings.push(message.text())
		}
	})
	await context.addCookies([
		{ name: 'sidebar-open', value: 'false', url: 'http://127.0.0.1:4173' },
	])

	await page.goto('/')
	await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
	expect(hydrationWarnings).toEqual([])
})

for (const [path, heading] of [
	['/levels', 'Levels and leaderboards'],
	['/users', 'Users and stats'],
	['/adventure/a', 'Adventure leaderboards'],
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

for (const [path, heading] of [
	['/terms', 'Terms & Conditions'],
	['/privacy', 'Privacy Policy'],
] as const) {
	test(`${path} legal document renders`, async ({ page }) => {
		await page.goto(path)
		await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
		await expect(page.getByText('Effective Date: 18/08/2025')).toBeVisible()
	})
}

test('/adventure redirects to Series A', async ({ page }) => {
	await page.goto('/adventure')
	await expect(page).toHaveURL(/\/adventure\/a$/)
})

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

for (const [path, heading] of [
	['/cosmetics', 'Cosmetics are coming next'],
	['/cosmetic/123', 'Cosmetic details are coming next'],
] as const) {
	test(`${path} placeholder is noindex`, async ({ page }) => {
		await page.goto(path)
		await expect(page.getByRole('heading', { name: heading })).toBeVisible()
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow',
		)
	})
}

for (const [path, title] of [
	['/totw', 'Track of the Week'],
	['/totm', 'Track of the Month'],
] as const) {
	test(`${path} renders active tournament or scheduled countdown`, async ({ page }) => {
		await page.goto(path)
		await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'index, follow',
		)
	})
}

for (const path of ['/totw/season-1', '/totm/july-2026'] as const) {
	test(`${path} rejects non-canonical tournament slug`, async ({ page }) => {
		const response = await page.goto(path)
		expect(response?.status()).toBe(404)
	})
}

test('/totd redirects to Track of the Week', async ({ page }) => {
	await page.goto('/totd')
	await expect(page).toHaveURL(/\/totw$/)
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
