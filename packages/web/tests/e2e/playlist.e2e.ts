import { expect, test } from '@playwright/test'

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
	await expect(page.getByRole('button', { name: 'Download .zeeplist' })).toBeDisabled()

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
