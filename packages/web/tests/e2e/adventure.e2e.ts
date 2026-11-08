import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

test.skip(
	process.env.ADVENTURE_BROWSER_FIXTURE !== '1',
	'Requires isolated Adventure GraphQL fixture',
)

async function hydrated(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

test.beforeEach(async ({ request }) => {
	await request.post('http://127.0.0.1:55440/__test/reset')
})

test('global and series standings preserve completion-first order, ties, pagination and level grids', async ({
	page,
}) => {
	await page.goto('/adventure')
	await hydrated(page)
	const leaderboard = page.getByRole('region', { name: 'Cumulative leaderboard' })
	await expect(leaderboard.locator('tbody tr')).toHaveCount(50)
	await expect(leaderboard.locator('tbody tr').first()).toContainText('2/18')
	await page.screenshot({ path: test.info().outputPath('adventure-global.png') })
	await page.getByRole('tab', { name: /^Series A/ }).click()
	await expect(leaderboard.locator('tbody tr').first()).toContainText('2/2')
	await expect(leaderboard.locator('tbody tr').nth(1)).toContainText('#1')
	await expect(leaderboard.locator('tbody tr').nth(2)).toContainText('#3')
	await expect(leaderboard.locator('tbody tr').nth(2)).toContainText('Partial')
	await expect(page.getByText('A-01', { exact: true }).first()).toBeVisible()
	await expect(page.getByText('A-02', { exact: true }).first()).toBeVisible()
	await leaderboard.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(leaderboard.locator('tbody tr')).toHaveCount(15)
	await expect(leaderboard.locator('tbody tr').first()).toContainText('#51')
	await expect(page).toHaveURL(/adventureAfter=/)
	await page.getByRole('tab', { name: /^Series XG/ }).click()
	await expect(leaderboard.getByText('No eligible Adventure PBs yet.')).toBeVisible()
	await expect(page.getByText('XG-01', { exact: true })).toBeVisible()
	await page.getByRole('tab', { name: 'All Adventure', exact: true }).click()
	await expect(leaderboard.locator('tbody tr').first()).toContainText('2/18')
})

test('live PB changes update standings without refresh', async ({ page, request }) => {
	await page.goto('/adventure/a')
	await hydrated(page)
	const leaderboard = page.getByRole('region', { name: 'Cumulative leaderboard' })
	await expect(leaderboard.locator('tbody tr').first()).toContainText('02:00.000')
	await expect.poll(async () => page.evaluate(() => document.visibilityState)).toBe('visible')
	await request.post('http://127.0.0.1:55440/__test/improve')
	await expect(leaderboard.locator('tbody tr').first()).toContainText('01:50.000', {
		timeout: 15_000,
	})
	await expect(leaderboard.locator('tbody tr').nth(1)).toContainText('#2')
})

test('viewer outside first page sees rank and linked missing levels', async ({ page }) => {
	await page.goto('/adventure/a')
	await hydrated(page)
	await expect(
		page.getByRole('region', { name: 'Cumulative leaderboard' }).locator('tbody tr'),
	).toHaveCount(50)
	// Exercise authenticated presentation without involving OAuth in this fixture.
	await page.evaluate(() => {
		const app = (
			document.querySelector('#__nuxt') as unknown as {
				__vue_app__: {
					config: {
						globalProperties: {
							$pinia: { _s: Map<string, { setUser(user: unknown): void }> }
						}
					}
				}
			}
		).__vue_app__
		app.config.globalProperties.$pinia._s
			.get('session')
			?.setUser({ id: 65, steamId: '76561198000000065', steamName: 'Adventure Player 65' })
	})
	await expect(page.getByText('Your progress', { exact: true })).toBeVisible()
	const progress = page.getByText('Your progress', { exact: true }).locator('..')
	await expect(progress).toContainText('#65')
	await expect(progress).toContainText('1/2')
	await progress.getByText('Missing levels (1)', { exact: true }).click()
	await expect(progress.getByRole('link', { name: 'A-02' })).toHaveAttribute(
		'href',
		'/level/00000000000000000000000000000002',
	)
	const leaderboard = page.getByRole('region', { name: 'Cumulative leaderboard' })
	await leaderboard.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(leaderboard.locator('tbody tr')).toHaveCount(15)
	await expect(leaderboard.locator('tbody tr').last()).toHaveClass(/bg-primary\/10/)
})
