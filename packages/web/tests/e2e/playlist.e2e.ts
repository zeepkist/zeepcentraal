import { expect } from '@playwright/test'
import { test } from '../support/browser'

const importedPlaylist = {
	name: 'Imported races',
	amountOfLevels: 2,
	roundLength: 480,
	shufflePlaylist: false,
	UID: [],
	levels: [
		{
			UID: 'uid-one',
			WorkshopID: 3755704991,
			Name: 'First level',
			Collaborators: '',
			OverrideAuthorName: '',
			Author: 'Akane',
			played: false,
		},
		{
			UID: 'uid-two',
			WorkshopID: 3755704992,
			Name: 'Second level',
			Collaborators: '',
			OverrideAuthorName: '',
			Author: 'Akane',
			played: false,
		},
	],
}

test('keeps playlist row controls reachable in portrait, landscape, and split view', async ({
	page,
	context,
	hasTouch,
	baseURL,
}) => {
	await context.addCookies([{ name: 'sidebar-open', value: 'true', url: baseURL }])
	await page.setViewportSize({ width: 320, height: 568 })
	await page.goto('/playlist')
	const longName = 'LongLevelName'.repeat(20)
	const levels = [
		{
			...importedPlaylist.levels[0],
			Name: longName,
			Author: 'LongAuthorName'.repeat(20),
			xxHash: 'layout-test-level',
			imageUrl: '/favicon-32x32.png',
		},
		importedPlaylist.levels[1],
	]
	await page.locator('input[type="file"]').setInputFiles({
		name: 'Layout test.zeeplist',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ ...importedPlaylist, levels })),
	})
	const name = page.getByRole('textbox', { name: 'Playlist name' })
	if (hasTouch) await expect(name).toHaveCSS('font-size', '16px')
	const rows = page.locator('[data-uid]')
	await expect(rows).toHaveCount(2)
	const linkedRow = rows.filter({ has: page.getByRole('link', { name: new RegExp(longName) }) })
	await expect(linkedRow.locator('img')).toBeVisible()
	await expect(rows.nth(1).locator('img')).toHaveCount(0)
	const remove = linkedRow.getByRole('button', { name: 'Remove level' })

	for (const { width, height, inline } of [
		{ width: 320, height: 568, inline: false },
		{ width: 390, height: 844, inline: false },
		{ width: 667, height: 375, inline: true },
		{ width: 1024, height: 600, inline: true },
		{ width: 1280, height: 900, inline: false },
		{ width: 1920, height: 900, inline: true },
	]) {
		await page.setViewportSize({ width, height })
		await expect(remove).toBeVisible()
		const layout = await linkedRow.evaluate((row) => {
			const bounds = row.getBoundingClientRect()
			const controls = [...row.querySelectorAll('button, .playlist-drag-handle')].map(
				(control) => control.getBoundingClientRect(),
			)
			return {
				controlsFit: controls.every(
					(control) =>
						control.width >= 44 &&
						control.height >= 44 &&
						control.left >= bounds.left &&
						control.right <=
							Math.min(bounds.right, document.documentElement.clientWidth),
				),
				inline: controls[0]?.top === controls[3]?.top,
				pageFits:
					document.documentElement.scrollWidth === document.documentElement.clientWidth,
				rowFits: row.scrollWidth === row.clientWidth,
			}
		})
		expect(layout, `${width} × ${height}`).toEqual({
			controlsFit: true,
			inline,
			pageFits: true,
			rowFits: true,
		})
	}

	await page.setViewportSize({ width: 320, height: 568 })
	await rows.first().getByRole('button', { name: 'Move level down' }).press('Enter')
	await expect(rows.first()).toHaveAttribute('data-uid', 'uid-two')
	const undo = page.getByRole('button', { name: 'Undo', exact: true })
	if (hasTouch) {
		await remove.tap()
		await undo.tap()
	} else {
		await remove.click()
		await undo.click()
	}
	await expect(rows).toHaveCount(2)
	await expect(rows.nth(1)).toHaveAttribute('data-uid', 'uid-one')
})

test('keeps filters, level cards, and pagination usable after rotating and resizing', async ({
	page,
}) => {
	await page.route('**/graphql', (route) => {
		const request = route.request()
		if (request.method() !== 'POST') return route.fallback()
		const { query, variables } = request.postDataJSON()
		if (!query?.includes('query ZC_Levels')) return route.fallback()
		const secondPage = Boolean(variables?.after)
		const name = secondPage ? 'Second browser page' : 'First browser page'
		const cursor = secondPage ? 'second-page' : 'first-page'
		return route.fulfill({
			headers: {
				'access-control-allow-origin': new URL(page.url()).origin,
				'access-control-allow-credentials': 'true',
			},
			json: {
				data: {
					levels: {
						edges: [
							{
								cursor,
								node: {
									id: secondPage ? 2 : 1,
									xxHash: cursor,
									adventure: false,
									dateCreated: '2026-10-01T00:00:00Z',
									levelItems: {
										nodes: [{ name, fileUid: cursor, workshopId: '123' }],
									},
									records: { totalCount: 0 },
									personalBestGlobals: { totalCount: 0 },
									votes: { totalCount: 0 },
								},
							},
						],
						totalCount: 2,
						pageInfo: {
							startCursor: cursor,
							endCursor: cursor,
							hasNextPage: !secondPage,
							hasPreviousPage: secondPage,
						},
					},
				},
			},
		})
	})
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/playlist')
	const playlist = page.getByTestId('playlist-pane')
	const browser = page.getByTestId('browser-pane')
	const findLevels = page.getByRole('button', { name: 'Find levels', exact: true })
	await expect(findLevels).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 })
	await findLevels.click()
	await expect(findLevels).toHaveAttribute('aria-pressed', 'true')
	await expect(playlist).toBeHidden()
	const search = browser.getByRole('textbox', { name: 'Name or hash' })
	await search.fill('browser')
	await browser.getByRole('button', { name: 'Apply filters' }).click()
	await expect(page).toHaveURL(/q=browser/)
	await expect(browser.getByRole('heading', { name: 'First browser page' })).toBeVisible()
	const pagination = browser.getByRole('navigation', { name: 'Results pagination' })
	const next = pagination.getByRole('button', { name: 'Next', exact: true })
	await expect(next).toHaveCSS('width', '44px')
	await expect(next.getByText('Next')).toBeHidden()
	await next.click()
	const secondLevel = browser.getByRole('heading', { name: 'Second browser page' })
	await expect(secondLevel).toBeVisible()
	await browser.getByRole('button', { name: 'Add to playlist' }).click()
	await expect(browser.getByRole('button', { name: 'Remove from playlist' })).toBeVisible()

	for (const viewport of [
		{ width: 667, height: 375 },
		{ width: 1280, height: 575 },
	]) {
		await page.setViewportSize(viewport)
		await expect(findLevels).toHaveAttribute('aria-pressed', 'true')
		await expect(browser).toBeVisible()
		await expect(playlist).toBeHidden()
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			),
		).toBe(0)
	}
	await page.setViewportSize({ width: 1280, height: 576 })
	await expect(findLevels).toBeHidden()
	await expect(browser).toBeVisible()
	await expect(playlist.getByText('Second browser page', { exact: true })).toBeVisible()

	for (const viewport of [
		{ width: 320, height: 568 },
		{ width: 2560, height: 900 },
	]) {
		await page.setViewportSize(viewport)
		const layout = await secondLevel.evaluate((heading) => {
			const grid = heading.closest('article')?.parentElement
			const section = heading.closest('section[aria-label]')
			if (!grid || !section) throw new Error('Missing level browser layout')
			return {
				columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
				filterColumns: getComputedStyle(
					section.firstElementChild as Element,
				).gridTemplateColumns.split(' ').length,
				pageFits:
					document.documentElement.scrollWidth === document.documentElement.clientWidth,
			}
		})
		expect(layout).toEqual({
			columns: viewport.width === 320 ? 1 : 4,
			filterColumns: viewport.width === 320 ? 1 : 2,
			pageFits: true,
		})
	}
	await page.setViewportSize({ width: 390, height: 844 })
	await expect(findLevels).toHaveAttribute('aria-pressed', 'true')
	await expect(playlist).toBeHidden()
})

test('imports, edits, persists, downloads, and deletes a local playlist', async ({ page }) => {
	await page.goto('/playlist')
	await expect(page.getByRole('heading', { name: 'Build a Zeepkist playlist' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Download .zeeplist' })).toBeDisabled({
		timeout: 30_000,
	})

	await page.locator('input[type="file"]').setInputFiles({
		name: 'Imported races.zeeplist',
		mimeType: 'application/json',
		buffer: Buffer.from(`\uFEFF${JSON.stringify(importedPlaylist)}`),
	})

	const nameInput = page.getByRole('textbox', { name: 'Playlist name' })
	await expect(nameInput).toHaveValue('Imported races')
	const rows = page.locator('[data-uid]')
	await expect(rows).toHaveCount(2)
	await page.getByRole('button', { name: 'Move level down' }).first().click()
	await expect(rows.nth(0)).toHaveAttribute('data-uid', 'uid-two')

	await nameInput.fill('CON')
	await nameInput.press('Tab')
	await expect(page.getByText('Saved locally')).toBeVisible()

	const downloadPromise = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Download .zeeplist' }).click()
	const download = await downloadPromise
	expect(download.suggestedFilename()).toBe('CON_.zeeplist')

	await page.reload()
	await expect(nameInput).toHaveValue('CON')
	await expect(rows.nth(0)).toHaveAttribute('data-uid', 'uid-two')
	await expect(page.getByRole('button', { name: 'Duplicate' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Download .zeeplist' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Delete' })).toBeEnabled()

	await page.getByRole('button', { name: 'Delete' }).click()
	const dialog = page.getByRole('dialog', { name: 'Delete playlist?' })
	await dialog.getByRole('button', { name: 'Delete' }).click()
	await expect(page.getByRole('heading', { name: 'No local playlists yet' })).toBeVisible()
})

for (const synchronize of [true, false]) {
	test(`preserves playlists across tabs ${synchronize ? 'with notifications' : 'without notifications'}`, async ({
		page,
		context,
	}) => {
		if (!synchronize) {
			await context.addInitScript(() =>
				Object.defineProperty(globalThis, 'BroadcastChannel', {
					value: undefined,
					configurable: true,
				}),
			)
		}
		await page.goto('/playlist')
		await page.locator('input[type="file"]').setInputFiles({
			name: 'Original.zeeplist',
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify({ ...importedPlaylist, name: 'Original' })),
		})
		await expect(page.getByRole('textbox', { name: 'Playlist name' })).toHaveValue('Original')
		await expect(page.getByText('Saved locally')).toBeVisible()
		const second = await context.newPage()
		await second.goto('/playlist')
		await expect(second.getByRole('textbox', { name: 'Playlist name' })).toHaveValue('Original')
		await page.locator('input[type="file"]').setInputFiles({
			name: 'New.zeeplist',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify({ ...importedPlaylist, name: 'New from first tab' }),
			),
		})
		await expect(page.getByRole('textbox', { name: 'Playlist name' })).toHaveValue(
			'New from first tab',
		)
		await expect(page.getByText('Saved locally')).toBeVisible()
		if (synchronize) {
			await second.getByRole('combobox', { name: 'Current playlist', exact: true }).click()
			await expect(second.getByRole('option', { name: 'New from first tab' })).toBeVisible()
			await second.keyboard.press('Escape')
		}
		const name = second.getByRole('textbox', { name: 'Playlist name' })
		await name.fill('Renamed in second tab')
		await name.press('Tab')
		await expect(second.getByText('Saved locally')).toBeVisible()
		await page.reload()
		await expect(page.getByRole('textbox', { name: 'Playlist name' })).toHaveValue(
			'Renamed in second tab',
		)
		await page.getByRole('combobox', { name: 'Current playlist', exact: true }).click()
		await expect(page.getByRole('option', { name: 'New from first tab' })).toBeVisible()
		await second.close()
	})
}
