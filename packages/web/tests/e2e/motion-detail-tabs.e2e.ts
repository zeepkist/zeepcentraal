import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '../support/browser'

async function openPage(page: Page, path = '/motion-detail-tabs') {
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function expectSelection(list: Locator) {
	await expect
		.poll(() =>
			list.evaluate((element) => {
				const active = element.querySelector('[role="tab"][aria-selected="true"]')
				const indicator = element.querySelector('[data-slot="indicator"]')
				if (!active || !indicator) return false
				const tab = active.getBoundingClientRect()
				const highlight = indicator.getBoundingClientRect()
				const bounds = element.getBoundingClientRect()
				return (
					Math.abs(tab.x - highlight.x) < 2 &&
					Math.abs(tab.width - highlight.width) < 2 &&
					Math.abs(tab.height - highlight.height) < 2 &&
					tab.left >= bounds.left &&
					tab.right <= bounds.right
				)
			}),
		)
		.toBe(true)
}

for (const width of [320, 375, 390, 1280]) {
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`profile tabs stay on one row at ${width}px in ${colorScheme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 })
			await page.emulateMedia({ colorScheme })
			await page
				.context()
				.addCookies([
					{ name: 'colour_mode', value: colorScheme, url: 'http://127.0.0.1:4173' },
				])
			await openPage(page)
			await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${colorScheme}\\b`))
			const list = page.getByRole('region', { name: 'Profile sections' }).getByRole('tablist')
			const tabs = list.getByRole('tab')
			await expect(tabs).toHaveCount(4)
			const geometry = await tabs.evaluateAll((elements) =>
				elements.map((element) => {
					const bounds = element.getBoundingClientRect()
					const label = element.querySelector('[data-slot="label"]')
					return {
						top: bounds.top,
						height: bounds.height,
						clipped: !label || label.scrollWidth > label.clientWidth,
					}
				}),
			)
			expect(new Set(geometry.map((tab) => tab.top)).size).toBe(1)
			expect(geometry.every((tab) => tab.height >= 44 && !tab.clipped)).toBe(true)
			await expectSelection(list)
			if (width === 375)
				await list.screenshot({ path: test.info().outputPath('detail-tabs.png') })
			await tabs.first().focus()
			await page.keyboard.press('End')
			await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
			await expectSelection(list)
			await page.keyboard.press('Home')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expectSelection(list)
			// Native horizontal scrolling keeps indicator in the same coordinate space.
			if (width < 1280) {
				await list.hover()
				await page.mouse.wheel(500, 0)
				await expect
					.poll(() => list.evaluate((element) => element.scrollLeft))
					.toBeGreaterThan(0)
			}
			await tabs.last().click()
			await expectSelection(list)
			// The existing site header overflows at 320px; tabs must not add page overflow.
			expect(
				await page.getByRole('region', { name: 'Profile sections' }).evaluate((element) => {
					const bounds = element.getBoundingClientRect()
					return (
						bounds.left >= 0 &&
						bounds.right <= innerWidth &&
						element.scrollWidth <= element.clientWidth
					)
				}),
			).toBe(true)
		})
	}
}

test('external changes reveal selection without scrolling page and preserve visited panels', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 900 })
	await openPage(page)
	const list = page.getByRole('region', { name: 'Profile sections' }).getByRole('tablist')
	await page.getByRole('textbox', { name: 'career input' }).fill('Retained text')
	await page.getByRole('button', { name: 'Select favourites externally' }).click()
	await expectSelection(list)
	expect(await page.evaluate(() => scrollY)).toBe(0)
	await list.getByRole('tab').last().focus()
	await page.keyboard.press('Home')
	await expect(page.getByRole('textbox', { name: 'career input' })).toHaveValue('Retained text')
	await page.getByRole('button', { name: 'Toggle long labels' }).click()
	await expectSelection(list)
	await page.getByRole('button', { name: 'Select favourites externally' }).click()
	await expectSelection(list)
	await page.setViewportSize({ width: 390, height: 900 })
	await expectSelection(list)
})

test('initial selection reveals fourth tab after hydration', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 })
	await openPage(page, '/motion-detail-tabs?tab=favourites')
	await expectSelection(
		page.getByRole('region', { name: 'Profile sections' }).getByRole('tablist'),
	)
})

test('level page shares scrollable tabs', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 })
	await openPage(page, '/level/fixture-hydration-level')
	const list = page.getByRole('tablist')
	await expect(list.getByRole('tab')).toHaveCount(3)
	await expect(list).toHaveCSS('flex-wrap', 'nowrap')
	await expectSelection(list)
})

test('profile page keeps fourth tab reachable', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 })
	await openPage(page, '/user/76561198000000888')
	const list = page.getByRole('tablist')
	await expect(list.getByRole('tab')).toHaveCount(4)
	await list.getByRole('tab').first().focus()
	await page.keyboard.press('End')
	await expect(list.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
	await expectSelection(list)
})

for (const view of ['analysis', 'code', 'voting']) {
	for (const width of [320, 375, 390, 1280]) {
		for (const colorScheme of ['light', 'dark'] as const) {
			test(`${view} tabs scroll at ${width}px in ${colorScheme}`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 })
				await page
					.context()
					.addCookies([
						{ name: 'colour_mode', value: colorScheme, url: 'http://127.0.0.1:4173' },
					])
				if (view === 'voting') {
					await page.route('**/api/super-league/vote?*', (route) =>
						route.fulfill({
							json: {
								roundId: 777,
								contestId: 1,
								submissionStart: null,
								submissionEnd: null,
								zslVoteEnd: null,
								cosmeticVoteEnd: null,
								submissionsOpen: false,
								votingPending: false,
								openTypes: [1, 2, 3],
								candidates: [],
								votes: [[], [1], [2]],
							},
						}),
					)
				}
				await openPage(page, `/motion-detail-tabs?view=${view}&roundId=777`)
				if (view === 'code') {
					await expect(page.getByRole('tablist')).toHaveCount(0)
					await page.getByRole('button', { name: 'Code examples' }).click()
				}
				const list = page.getByRole('tablist')
				const tabs = list.getByRole('tab')
				await expect(tabs).toHaveCount(view === 'analysis' ? 4 : 3)
				await expect(list).toHaveCSS('flex-wrap', 'nowrap')
				await expectSelection(list)
				const geometry = await tabs.evaluateAll((elements) =>
					elements.map((element) => {
						const bounds = element.getBoundingClientRect()
						const label = element.querySelector('[data-slot="label"]')
						return {
							top: bounds.top,
							height: bounds.height,
							clipped: !label || label.scrollWidth > label.clientWidth,
						}
					}),
				)
				expect(new Set(geometry.map((tab) => tab.top)).size).toBe(1)
				expect(geometry.every((tab) => tab.height >= 44 && !tab.clipped)).toBe(true)
				await tabs.first().focus()
				await page.keyboard.press('End')
				await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
				await expectSelection(list)
				await page.keyboard.press('Home')
				await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
				await expectSelection(list)
				expect(
					await list.evaluate((element) => {
						const bounds = element.getBoundingClientRect()
						return bounds.left >= 0 && bounds.right <= innerWidth
					}),
				).toBe(true)
				if (view === 'voting')
					await expect(list.getByText('Saved', { exact: true })).toHaveCount(2)
				if (view === 'code') {
					await page.getByRole('button', { name: 'Code examples' }).click()
					await page.getByRole('button', { name: 'Code examples' }).click()
					await expectSelection(list)
				}
			})
		}
	}
}
