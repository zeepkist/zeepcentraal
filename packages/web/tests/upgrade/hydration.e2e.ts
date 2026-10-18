import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

test('playlist actions stay disabled before client hydration', async ({ browser, baseURL }) => {
	test.setTimeout(120_000)
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
	try {
		const page = await context.newPage()
		for (const path of ['/', '/level/fixture-hydration-level']) {
			await page.goto(path, { waitUntil: 'domcontentloaded' })
			await expect(
				page.getByRole('button', { name: 'Add to playlist', exact: true }).first(),
			).toBeDisabled()
		}
	} finally {
		await context.close()
	}
})

async function expectHealthyPage(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	// The reported failure occurs in mounted hooks after async content resolves.
	await page.waitForTimeout(15_000)
	expect(
		await page.evaluate(() => {
			const root = document.querySelector('#__nuxt') as Element & {
				__vue_app__?: {
					config: { globalProperties: { $nuxt?: { payload: { error?: unknown } } } }
				}
			}
			return root?.__vue_app__?.config.globalProperties.$nuxt?.payload.error ?? null
		}),
	).toBeNull()
	await expect(page.getByRole('heading', { name: 'Page error', exact: true })).toHaveCount(0)
}

async function expectStoredLevel(page: Page, present: boolean) {
	// Wait for the IndexedDB transaction, not only the optimistic button label.
	await expect
		.poll(() =>
			page.evaluate(async () => {
				const request = indexedDB.open('zeepcentraal-playlists')
				const database = await new Promise<IDBDatabase>((resolve, reject) => {
					request.onsuccess = () => resolve(request.result)
					request.onerror = () => reject(request.error)
				})
				try {
					const records = database
						.transaction('playlists')
						.objectStore('playlists')
						.getAll()
					return await new Promise<boolean>((resolve, reject) => {
						records.onsuccess = () =>
							resolve(
								records.result.some((playlist) =>
									playlist.levels.some(
										(level: { UID: string }) =>
											level.UID === 'fixture-hydration-uid',
									),
								),
							)
						records.onerror = () => reject(records.error)
					})
				} finally {
					database.close()
				}
			}),
		)
		.toBe(present)
}

test('dashboard and level pages survive hydration with playlist attributes and persisted actions', async ({
	page,
}) => {
	test.setTimeout(180_000)
	await page.goto('/', { waitUntil: 'domcontentloaded' })
	await expectHealthyPage(page)
	const card = page
		.locator('article')
		.filter({
			has: page.getByRole('heading', { name: 'Fixture hydration level', exact: true }),
		})
		.first()
	const add = card.getByRole('button', { name: 'Add to playlist', exact: true })
	await expect(add).toBeEnabled()
	await expect(add).toHaveClass(/flex-1/)
	await expect(add).toHaveClass(/w-full/)
	await expect(add).toHaveAttribute('autocomplete', 'off')
	const cardButtonHeight = (await add.boundingBox())?.height ?? 0
	await add.click()
	await expect(
		card.getByRole('button', { name: 'Remove from playlist', exact: true }),
	).toBeEnabled()
	await expectStoredLevel(page, true)
	await page.reload()
	await expectHealthyPage(page)
	await expect(
		card.getByRole('button', { name: 'Remove from playlist', exact: true }),
	).toBeEnabled()
	await card
		.locator('a')
		.filter({
			has: page.getByRole('heading', { name: 'Fixture hydration level', exact: true }),
		})
		.click()
	await expect(page).toHaveURL('/level/fixture-hydration-level')
	const remove = page.getByRole('button', { name: 'Remove from playlist', exact: true })
	await expect(remove).toBeEnabled()
	expect((await remove.boundingBox())?.height ?? 0).toBeGreaterThan(cardButtonHeight)
	await remove.click()
	await expect(page.getByRole('button', { name: 'Add to playlist', exact: true })).toBeEnabled()
	await expectStoredLevel(page, false)
	await page.reload()
	await expect(
		page.getByRole('heading', { name: 'Fixture hydration level', exact: true }),
	).toBeVisible()
	await expectHealthyPage(page)
	await expect(page.getByRole('button', { name: 'Add to playlist', exact: true })).toBeEnabled()
})
