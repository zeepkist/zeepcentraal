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
