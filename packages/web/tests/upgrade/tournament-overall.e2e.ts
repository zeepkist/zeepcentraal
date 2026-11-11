import { expect, type Page } from '@playwright/test'
import { AUTH_RETURN_PATH_STORAGE_KEY } from '../../app/utils/auth-return-path'
import { test } from '../support/browser'

async function waitForHydration(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

for (const [root, label, count] of [
	['totd', 'Daily', 30],
	['totw', 'Weekly', 12],
	['totm', 'Monthly', 6],
] as const) {
	test(`${root} overall route, shared ranks, pagination, and current-event navigation`, async ({
		page,
	}) => {
		const response = await page.goto(`/${root}/overall`)
		await waitForHydration(page)
		expect(response?.status()).toBe(200)
		await expect(page.getByText(`${count} eligible events`, { exact: true })).toBeVisible()
		const title = `Track of the ${root === 'totw' ? 'Week' : root === 'totd' ? 'Day' : 'Month'} Overall Leaderboard`
		await expect(
			page.getByRole('heading', { level: 1, name: title, exact: true }),
		).toBeVisible()
		await expect(page).toHaveTitle(new RegExp(title))
		await expect(
			page.getByText('Standings update after the current tournament ends', { exact: true }),
		).toHaveCount(1)
		await expect(page.getByText(/Points awarded in completed events stay fixed/)).toHaveCount(0)
		await expect(page.locator('dl dt')).toHaveText(
			[/Eligible period/, /^Rotation$/, /^Last updated$/],
			{ useInnerText: true },
		)
		await expect(page.locator('dl dd').first()).not.toContainText(/6:00|06:00|UTC/)
		await expect(page.locator('dl dd').last()).toContainText('UTC')
		const firstCell = page.locator('tbody tr').first().locator('td').nth(1)
		await expect(firstCell.getByRole('img')).toBeVisible()
		await expect(page.locator('tbody tr').nth(4).getByRole('link')).toHaveCount(0)
		await expect(page.locator('tbody tr').nth(4)).toContainText('Player without profile')
		await expect(
			page.getByRole('link', { name: `${label} player 1`, exact: true }),
		).toHaveAttribute('href', '/user/76561198000000000')
		await expect(page.locator('tbody tr').nth(0)).toContainText('#1')
		await expect(page.locator('tbody tr').nth(1)).toContainText('#1')
		await expect(page.locator('tbody tr').nth(2)).toContainText('#3')
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			`https://zeepki.st/${root}/overall`,
		)
		await page.getByRole('button', { name: 'Next', exact: true }).click()
		await expect(page).toHaveURL(/overallAfter=/)
		await expect(
			page.getByRole('link', { name: `${label} player 51`, exact: true }),
		).toBeVisible()
		await page.goBack()
		await expect(
			page.getByRole('link', { name: `${label} player 1`, exact: true }),
		).toBeVisible()
		await page.getByRole('link', { name: 'Current Event', exact: true }).click()
		await expect(page).toHaveURL(new RegExp(`/${root}$`))
		await expect(page.getByText('Past Tournaments', { exact: true })).toBeVisible()
		await page.getByRole('link', { name: 'Overall Leaderboard', exact: true }).click()
		await expect(page).toHaveURL(new RegExp(`/${root}/overall$`))
		await expect(page.getByText(`${count} eligible events`, { exact: true })).toBeVisible()
	})
}

test('overall displays empty and error states', async ({ page }) => {
	await page.goto('/totm')
	await waitForHydration(page)
	await page.route('**/graphql', async (route) => {
		if (!route.request().postData()?.includes('ZC_TrackTournamentOverall'))
			return route.continue()
		await route.fulfill({
			json: {
				data: {
					period: null,
					standings: {
						nodes: [],
						totalCount: 0,
						pageInfo: {
							hasNextPage: false,
							hasPreviousPage: false,
							startCursor: null,
							endCursor: null,
						},
					},
				},
			},
		})
	})
	await page.getByRole('link', { name: 'Overall Leaderboard', exact: true }).click()
	await expect(page).toHaveURL(/\/totm\/overall$/)
	await expect(
		page.getByText('No completed competitive results yet.', { exact: true }),
	).toBeVisible()
	await page.unroute('**/graphql')
	await page.route('**/graphql', async (route) => {
		if (!route.request().postData()?.includes('ZC_TrackTournamentOverall'))
			return route.continue()
		await route.fulfill({ json: { errors: [{ message: 'Overall fixture unavailable' }] } })
	})
	await page.getByRole('link', { name: 'Current Event', exact: true }).click()
	await page.getByRole('link', { name: 'Overall Leaderboard', exact: true }).click()
	await expect(page.getByText(/Overall fixture unavailable/)).toBeVisible()
})

test('overall pins authenticated viewer outside page and removes duplicate on viewer page', async ({
	page,
}, testInfo) => {
	await page.route('**/api/session', (route) =>
		route.fulfill({
			json: {
				user: { id: 51, steamId: '76561198000000050', steamName: 'Weekly player 51' },
				isAdmin: false,
				refreshAt: null,
			},
		}),
	)
	await page.addInitScript(({ key }) => localStorage.setItem(key, '/totw/overall'), {
		key: AUTH_RETURN_PATH_STORAGE_KEY,
	})
	await page.goto('/?auth=callback')
	await expect(page).toHaveURL('/totw/overall', { timeout: 15_000 })
	await waitForHydration(page)
	await expect(page.getByText('You', { exact: true })).toBeVisible()
	await expect(page.locator('tbody tr')).toHaveCount(51)
	const playerCell = page.locator('tbody tr').last().locator('td').nth(1)
	await expect(playerCell.getByRole('img')).toBeVisible()
	const alignment = await playerCell.evaluate((cell) => {
		const name = cell.querySelector('.truncate')?.getBoundingClientRect()
		const icon = cell.querySelector('[role="img"]')?.getBoundingClientRect()
		const badge = Array.from(cell.querySelectorAll('span'))
			.find((span) => span.textContent === 'You')
			?.getBoundingClientRect()
		if (!name || !icon || !badge)
			throw new Error('Player name, supporter icon, and viewer badge required')
		return {
			name: name.y + name.height / 2,
			icon: icon.y + icon.height / 2,
			badge: badge.y + badge.height / 2,
		}
	})
	expect(Math.abs(alignment.name - alignment.icon)).toBeLessThan(2)
	expect(Math.abs(alignment.name - alignment.badge)).toBeLessThan(2)
	await page.locator('tbody tr').nth(3).scrollIntoViewIfNeeded()
	const truncates = await page
		.locator('tbody tr')
		.nth(3)
		.locator('.truncate')
		.evaluate((name) => name.scrollWidth > name.clientWidth)
	expect(truncates).toBe(true)
	for (const theme of ['dark', 'light']) {
		await page.evaluate((value) => {
			document.documentElement.classList.remove('dark', 'light')
			document.documentElement.classList.add(value)
		}, theme)
		await page.evaluate(() => window.scrollTo(0, 0))
		await page.screenshot({ path: testInfo.outputPath(`overall-${theme}.png`) })
		await playerCell.scrollIntoViewIfNeeded()
		await playerCell.screenshot({ path: testInfo.outputPath(`player-${theme}.png`) })
	}
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page.locator('tbody tr')).toHaveCount(1)
	await expect(page.getByText('You', { exact: true })).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Weekly player 51', exact: true })).toBeVisible()
})

test('totd index keeps daily route', async ({ page }) => {
	const index = await page.goto('/totd')
	await waitForHydration(page)
	expect(index?.status()).toBe(200)
	await expect(page).toHaveURL('/totd')
	await expect(page).toHaveTitle(/Track of the Day/)
})

test('totd event, metadata, and playlist use daily routes', async ({ page, request }) => {
	const detail = await page.goto('/totd/2026-11-11')
	await waitForHydration(page)
	expect(detail?.status()).toBe(200)
	const preview = page.locator('script[id="discord:component-embed"]')
	await expect(preview).toHaveCount(1)
	await expect.poll(() => preview.textContent()).toContain('/totd/overall')
	await expect.poll(() => preview.textContent()).toContain('Preview player 1')
	const playlist = await request.get('/api/tournaments/playlist?type=2&slug=2026-11-11')
	expect(playlist.status()).toBe(200)
	expect(playlist.headers()['content-disposition']).toContain(
		'zeepcentraal-totd-2026-11-11.zeeplist',
	)
	const invalidPlaylist = await request.get('/api/tournaments/playlist?type=2&slug=2026-02-29')
	expect(invalidPlaylist.status()).toBe(400)
	const invalidEvent = await request.get('/totd/2026-02-29')
	expect(invalidEvent.status()).toBe(404)
})
