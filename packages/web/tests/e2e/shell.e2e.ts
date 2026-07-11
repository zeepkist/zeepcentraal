import { expect, test } from '@playwright/test'

test('home shell renders', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Zeepkist stats hub' })).toBeVisible()
	await expect(page.getByRole('link', { name: /Steam/ })).toBeVisible()
})

test('theme button is available', async ({ page }) => {
	await page.goto('/')
	await page.getByRole('button', { name: 'Theme' }).click()
})

for (const [path, heading] of [
	['/levels', 'Levels and leaderboards'],
	['/users', 'Users and stats'],
	['/adventure', 'Adventure leaderboards'],
	['/wiki', 'Zeepkist wiki'],
	['/developer', 'Developer portal'],
	['/developer/graphql', 'GraphQL guide'],
	['/zsl', 'ZSL results'],
] as const) {
	test(`${path} route renders`, async ({ page }) => {
		await page.goto(path)
		await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
	})
}

test('records live subscription renders', async ({ page }) => {
	await page.goto('/records')
	await expect(
		page.getByRole('heading', { name: 'World records and personal bests' }),
	).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Latest record' })).toBeVisible()
	await expect(page.getByRole('status')).toBeVisible()
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
