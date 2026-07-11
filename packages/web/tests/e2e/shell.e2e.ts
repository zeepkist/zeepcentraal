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
