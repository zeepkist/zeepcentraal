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

test('placeholder route renders', async ({ page }) => {
	await page.goto('/levels')

	await expect(page.getByRole('heading', { name: 'Levels and leaderboards' })).toBeVisible()
})
