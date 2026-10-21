import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

async function waitForHydration(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function reloadPage(page: Page) {
	await waitForHydration(page)
	// Firefox can report NS_BINDING_ABORTED from Page.reload despite HTTP 200.
	await Promise.all([
		page.waitForEvent('domcontentloaded'),
		page.evaluate(() => window.location.reload()),
	])
	await waitForHydration(page)
}

test('mod SSR isolates navigation headers while API origin checks remain enforced', async ({
	request,
}) => {
	test.setTimeout(120_000)
	for (const headers of [
		{ 'sec-fetch-site': 'cross-site' },
		{ origin: 'https://other.example.test' },
	]) {
		for (const path of ['/mods', '/mod/zeepkist-gtr']) {
			const response = await request.get(path, { headers })
			expect(response.status()).toBe(200)
			const html = await response.text()
			expect(html).toMatch(/<h[13][^>]*>Fixture GTR<\/h[13]>/)
			expect(html).not.toContain('Cross-origin API requests are not allowed')
			if (path.startsWith('/mod/')) {
				expect(html).toContain('<p>Fixture GTR description</p>')
				expect(html).toMatch(/<h3[^>]*>Fixture SDK<\/h3>/)
			} else {
				expect(html).toMatch(/<h3[^>]*>Fixture Timer<\/h3>/)
				// Utility appears only in tag options, not in either mod's tags.
				expect(html).toContain('Utility')
			}
		}
		for (const path of [
			'/api/modio/mods',
			'/api/modio/tags',
			'/api/modio/mods/zeepkist-gtr?dependencies=true',
		]) {
			const response = await request.get(path, { headers })
			expect(response.status()).toBe(403)
		}
	}
	const tags = await request.get('/api/modio/tags')
	expect(tags.status()).toBe(200)
	expect(await tags.json()).toEqual({ tags: ['Racing', 'Timing', 'Utility'] })
})

test('mods support direct loads, reloads, client navigation, filters, and dependencies', async ({
	page,
}) => {
	test.setTimeout(120_000)
	await page.goto('/mod/zeepkist-gtr')
	await expect(
		page.getByRole('heading', { level: 1, name: 'Fixture GTR', exact: true }),
	).toBeVisible()
	await expect(page.getByRole('link', { name: 'Fixture SDK', exact: true })).toBeVisible()
	await reloadPage(page)
	await expect(
		page.getByRole('heading', { level: 1, name: 'Fixture GTR', exact: true }),
	).toBeVisible()
	await waitForHydration(page)

	await page.goto('/mods')
	await expect(page.getByRole('link', { name: 'Fixture GTR', exact: true })).toBeVisible()
	await reloadPage(page)
	await expect(page.getByRole('link', { name: 'Fixture Timer', exact: true })).toBeVisible()
	await waitForHydration(page)
	await page.getByRole('link', { name: 'Fixture GTR', exact: true }).click()
	await expect(page).toHaveURL(/\/mod\/zeepkist-gtr$/)
	await expect(page.getByRole('link', { name: 'Fixture SDK', exact: true })).toBeVisible()
	await page.goBack()
	await expect(page).toHaveURL(/\/mods$/)
	await page.locator('form input').fill('Timer')
	await page.locator('form button[type="submit"]').click()
	await expect(page).toHaveURL(/q=Timer/)
	await expect(page.getByRole('link', { name: 'Fixture Timer', exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Fixture GTR', exact: true })).toHaveCount(0)
	await page.goto('/mods?tags=Racing')
	await expect(page.getByRole('link', { name: 'Fixture GTR', exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Fixture Timer', exact: true })).toHaveCount(0)
	await waitForHydration(page)

	await page.goto('/support')
	await waitForHydration(page)
	await page.locator('footer a[href="/mods"]').click()
	await expect(page).toHaveURL(/\/mods$/)
	await expect(page.getByRole('link', { name: 'Fixture Timer', exact: true })).toBeVisible()
})
