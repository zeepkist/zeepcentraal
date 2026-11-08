import { readFile } from 'node:fs/promises'
import { type BrowserContext, expect, type Page } from '@playwright/test'
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

async function login(context: BrowserContext, zero = false) {
	for (const [name, value] of Object.entries({
		zeepcentral_steam_id: zero ? '76561198000000066' : '76561198000000065',
		zeepcentral_access_token: zero ? 'fake-adventure-zero-access' : 'fake-adventure-access',
		zeepcentral_refresh_token: zero ? 'fake-adventure-zero-refresh' : 'fake-adventure-refresh',
	}))
		await context.addCookies([{ name, value, url: 'http://127.0.0.1:4173' }])
}

async function playlistDownload(page: Page, label: string) {
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: label, exact: true }).click()
	const file = await download
	const path = await file.path()
	if (!path) throw new Error('Playlist download missing')
	return {
		name: file.suggestedFilename(),
		playlist: JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')),
	}
}

test.beforeEach(async ({ request }) => {
	await request.post('http://127.0.0.1:55440/__test/reset')
})

test('global and series standings preserve completion-first order, ties, pagination and level grids', async ({
	page,
}) => {
	await page.goto('/adventure')
	await hydrated(page)
	const leaderboard = page.getByRole('region', { name: 'Leaderboard' })
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
	const leaderboard = page.getByRole('region', { name: 'Leaderboard' })
	await expect(leaderboard.locator('tbody tr').first()).toContainText('02:00.000')
	await expect.poll(async () => page.evaluate(() => document.visibilityState)).toBe('visible')
	await request.post('http://127.0.0.1:55440/__test/improve')
	await expect(leaderboard.locator('tbody tr').first()).toContainText('01:50.000', {
		timeout: 15_000,
	})
	await expect(leaderboard.locator('tbody tr').nth(1)).toContainText('#2')
})

test('viewer is pinned with inline supporter and You badges, and expands PB/WR details', async ({
	page,
	context,
	request,
}) => {
	await login(context)
	await page.goto('/adventure/a')
	await hydrated(page)
	const leaderboard = page.getByRole('region', { name: 'Leaderboard', exact: true })
	const rows = leaderboard.locator('tr[data-adventure-player]')
	await expect(rows).toHaveCount(51)
	const viewer = leaderboard.locator('tr[data-adventure-player="65"]')
	await expect(viewer).toContainText('#65')
	await expect(viewer).toContainText('You')
	await expect(viewer.getByRole('img', { name: /Fixture supporter/ })).toBeVisible()
	const name = await viewer.getByRole('link').boundingBox()
	const badge = await viewer.getByText('You', { exact: true }).boundingBox()
	expect(
		name && badge && badge.y >= name.y && badge.y + badge.height <= name.y + name.height,
	).toBeTruthy()
	const progress = page.getByTestId('adventure-progress')
	await expect(progress).toContainText('1/2')
	await expect(progress).toContainText(
		'Combined gap to #64 Adventure Player 64: 00:00.010 (levels compared: 1).',
	)
	await progress.screenshot({ path: test.info().outputPath('adventure-summary.png') })
	await request.post('http://127.0.0.1:55440/__test/long-player')
	await expect(viewer.getByRole('link')).toContainText('W'.repeat(120))
	await expect(progress).toContainText('X'.repeat(120))
	expect(
		await progress.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
	).toBeTruthy()
	const longName = await viewer.getByRole('link').boundingBox()
	const inlineBadge = await viewer.getByText('You', { exact: true }).boundingBox()
	expect(
		longName &&
			inlineBadge &&
			inlineBadge.y >= longName.y &&
			inlineBadge.y + inlineBadge.height <= longName.y + longName.height,
	).toBeTruthy()
	await progress.getByRole('button', { name: 'View your level times' }).click()
	const detail = page.getByTestId('adventure-player-levels')
	await expect(detail.locator('tr[data-adventure-level]')).toHaveCount(2)
	await expect(detail.locator('tr[data-adventure-level="1"]')).toContainText('+00:00.620')
	await expect(detail.locator('tr[data-adventure-level="2"]')).toContainText('Not completed')
	await request.post('http://127.0.0.1:55440/__test/advance-wr')
	await expect(detail.locator('tr[data-adventure-level="1"]')).toContainText('+00:00.650')
	await detail.getByRole('combobox').click()
	await page.getByRole('option', { name: 'Largest WR gap' }).click()
	await expect(detail.locator('tr[data-adventure-level]').first()).toHaveAttribute(
		'data-adventure-level',
		'2',
	)
	await viewer.getByRole('button', { name: /Hide level times/ }).click()
	await expect(detail).toHaveCount(0)
	await leaderboard.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(rows).toHaveCount(15)
	await expect(viewer).toHaveCount(1)
	await expect(viewer).toHaveClass(/bg-primary\/10/)
	await page.screenshot({ path: test.info().outputPath('adventure-progress.png') })
})

test('global rows load details on demand and deduplicate shared canonical levels', async ({
	page,
}) => {
	let detailRequests = 0
	page.on('request', (request) => {
		if (request.postData()?.includes('ZC_AdventurePlayerLevels')) detailRequests++
	})
	await page.goto('/adventure')
	await hydrated(page)
	expect(detailRequests).toBe(0)
	await page
		.getByRole('button', { name: 'Show level times for Adventure Player 1', exact: true })
		.click()
	const detail = page.getByTestId('adventure-player-levels')
	await expect(detail.locator('tr[data-adventure-level]')).toHaveCount(18)
	await expect(detail.getByRole('link', { name: 'A-01', exact: true })).toHaveCount(1)
	await expect(detail.getByRole('link', { name: 'B-01', exact: true })).toHaveCount(0)
	await expect(detail.getByRole('columnheader', { name: 'Series XG', exact: true })).toBeVisible()
	await detail.screenshot({ path: test.info().outputPath('adventure-expanded.png') })
})

test('downloads full series, global and authenticated missing-level playlists', async ({
	page,
	context,
	request,
}) => {
	expect((await request.get('/api/adventure/playlist?missing=true')).status()).toBe(401)
	expect((await request.get('/api/adventure/playlist?series=unknown')).status()).toBe(400)
	await login(context)
	await page.goto('/adventure/a')
	await hydrated(page)
	const series = await playlistDownload(page, 'Download Series A')
	expect(series.playlist.levels.map((level: { Name: string }) => level.Name)).toEqual([
		'A-01',
		'A-02',
	])
	expect(series.playlist).toMatchObject({
		amountOfLevels: 2,
		roundLength: 480,
		shufflePlaylist: false,
	})
	const all = await playlistDownload(page, 'Download all Adventure')
	expect(all.playlist.amountOfLevels).toBe(18)
	const missing = await playlistDownload(page, 'Download missing levels (1)')
	expect(missing.name).toBe('zeepcentraal-adventure-a-missing.zeeplist')
	expect(missing.playlist.levels.map((level: { Name: string }) => level.Name)).toEqual(['A-02'])
	const verified = await context.request.get(
		'/api/adventure/playlist?series=a&missing=true&userId=1',
	)
	expect(verified.headers()['cache-control']).toContain('no-store')
	expect(JSON.parse((await verified.text()).replace(/^\uFEFF/, '')).levels).toHaveLength(1)
})

test('zero-PB viewer receives unranked summary and all missing levels without fake placement', async ({
	page,
	context,
}) => {
	await login(context, true)
	await page.goto('/adventure/a')
	await hydrated(page)
	await expect(page.getByTestId('adventure-progress')).toContainText('Unranked')
	await expect(page.getByTestId('adventure-progress')).toContainText('0/2')
	await expect(page.locator('tr[data-adventure-player="66"]')).toHaveCount(0)
	const missing = await playlistDownload(page, 'Download missing levels (2)')
	expect(missing.playlist.amountOfLevels).toBe(2)
})
