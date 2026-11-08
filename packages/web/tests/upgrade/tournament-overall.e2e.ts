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
}) => {
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
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page.locator('tbody tr')).toHaveCount(1)
	await expect(page.getByText('You', { exact: true })).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Weekly player 51', exact: true })).toBeVisible()
})
