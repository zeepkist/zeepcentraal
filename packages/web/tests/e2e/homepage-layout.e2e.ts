import { expect } from '@playwright/test'
import { test } from '../support/browser'

for (const [path, classes] of [
	['/cosmetics', 'w-full max-w-(--ui-container) mx-auto py-2'],
	['/levels', 'w-full mx-auto max-w-[100rem] py-2'],
	['/lobby/history', 'w-full mx-auto max-w-7xl space-y-6 py-2'],
	['/playlist', 'w-full mx-auto max-w-none py-4 sm:py-6'],
] as const) {
	test(`${path} uses shared page container spacing`, async ({ request }) => {
		const response = await request.get(path)
		await expect(response).toBeOK()
		const html = await response.text()
		const container = html.match(
			/<main\b[^>]*app-page-content[^>]*>(?:\s|<!--.*?-->)*<div class="([^"]*)"/,
		)
		expect(container?.[1]).toBe(classes)
	})
}

test('homepage announcements fit within the main padding', async ({ page }) => {
	const longText = 'Announcement'.repeat(40)
	await page.route('**/api/steam-news', (route) =>
		route.fulfill({
			json: [
				{
					id: 'layout-test',
					title: longText,
					author: longText,
					contents: longText,
					url: 'https://store.steampowered.com/app/1440670/',
					date: '2026-10-01T00:00:00Z',
				},
			],
		}),
	)

	await page.goto('/', { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	const news = page.locator('section[aria-labelledby="steam-news-heading"]')
	await expect(news.locator('..')).toHaveClass(
		'w-full max-w-(--ui-container) mx-auto space-y-8 py-2',
	)
	await news.getByRole('heading', { level: 2 }).scrollIntoViewIfNeeded()
	const card = news.getByRole('heading', { name: longText, exact: true }).locator('..')
	await expect(card).toBeVisible()

	const layout = await card.evaluate((element) => {
		const main = element.closest('main')
		const section = element.closest('section')
		if (!main || !section) throw new Error('Missing homepage layout')

		const mainBounds = main.getBoundingClientRect()
		const mainStyle = getComputedStyle(main)
		const sectionBounds = section.getBoundingClientRect()
		return {
			leftInset: sectionBounds.left - mainBounds.left,
			rightInset: mainBounds.right - sectionBounds.right,
			paddingLeft: Number.parseFloat(mainStyle.paddingLeft),
			paddingRight: Number.parseFloat(mainStyle.paddingRight),
			cardWidth: element.clientWidth,
			cardScrollWidth: element.scrollWidth,
			pageWidth: document.documentElement.clientWidth,
			pageScrollWidth: document.documentElement.scrollWidth,
		}
	})

	expect(layout.leftInset).toBeCloseTo(layout.paddingLeft)
	expect(layout.rightInset).toBeCloseTo(layout.paddingRight)
	expect(layout.cardScrollWidth).toBe(layout.cardWidth)
	expect(layout.pageScrollWidth).toBe(layout.pageWidth)
})
