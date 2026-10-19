import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

async function openPage(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function importPlaylist(page: Page) {
	await page.locator('input[type="file"]').setInputFiles({
		name: 'Motion.zeeplist',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({
				name: 'Motion',
				amountOfLevels: 2,
				roundLength: 480,
				shufflePlaylist: false,
				UID: [],
				levels: [1, 2].map((index) => ({
					UID: `motion-${index}`,
					WorkshopID: 123 + index,
					Name: `Motion level ${index}`,
					Collaborators: '',
					OverrideAuthorName: '',
					Author: 'Fixture',
					played: false,
				})),
			}),
		),
	})
	await expect(page.locator('[data-uid]')).toHaveCount(2)
}

async function sortableDuration(page: Page) {
	return page
		.locator('[data-uid]')
		.first()
		.evaluate((row) => {
			const list = row.parentElement
			if (!list) return null
			const instance = Object.entries(list).find(([key]) =>
				key.startsWith('Sortable'),
			)?.[1] as { option: (name: string) => number } | undefined
			return instance?.option('animation') ?? null
		})
}

async function paneAnimations(page: Page) {
	return page.getByTestId('browser-pane').evaluate((element) => element.getAnimations().length)
}

test('card hover keeps 160ms timing and reduced motion removes displacement but retains feedback', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 900 })
	await openPage(page, '/')
	const card = page
		.locator('article')
		.filter({
			has: page.getByRole('heading', { name: 'Fixture hydration level', exact: true }),
		})
		.first()
	await expect(card).toBeVisible()
	await expect(card).toHaveCSS('transition-duration', '0.16s')
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await card.hover()
	await expect(card).toHaveCSS('translate', 'none')
	await expect(card).toHaveCSS('transition-duration', '0.125s')
	await expect(card).toHaveCSS(
		'transition-property',
		'color, background-color, border-color, opacity',
	)
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await expect(card).toHaveCSS('transition-duration', '0.16s')
})

test('press feedback handles pointer release, keyboard, disabled, loading and reduced motion', async ({
	page,
}) => {
	await openPage(page, '/level/fixture-hydration-level')
	const button = page.locator('button.motion-press').first()
	await expect(button).toBeEnabled()
	await button.scrollIntoViewIfNeeded()
	const box = await button.boundingBox()
	if (!box) throw new Error('Missing playlist button')
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
	await page.mouse.down()
	await expect(button).toHaveCSS('scale', '0.97')
	await page.mouse.move(0, 0)
	await page.mouse.up()
	await expect(button).toHaveCSS('scale', 'none')

	await button.focus()
	await page.keyboard.down('Space')
	await expect(button).toHaveCSS('scale', 'none')
	await page.keyboard.up('Space')

	for (const attribute of ['disabled', 'aria-disabled', 'aria-busy']) {
		await button.evaluate((element, name) => element.setAttribute(name, 'true'), attribute)
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await expect(button).toHaveCSS('scale', 'none')
		await page.mouse.up()
		await button.evaluate((element, name) => element.removeAttribute(name), attribute)
	}
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.mouse.down()
	await expect(button).toHaveCSS('scale', 'none')
	await page.mouse.up()
})

test('search keyboard highlighting changes without transitions', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 })
	await page.route('**/graphql', async (route) => {
		if (!String(route.request().postDataJSON()?.query).includes('ZC_OmniSearch'))
			return route.fallback()
		await route.fulfill({
			json: {
				data: {
					rankedUsers: {
						nodes: [1, 2].map((id) => ({
							id,
							steamId: String(id),
							steamName: `Motion player ${id}`,
							userPoints: { rank: id },
						})),
					},
					unrankedUsers: { nodes: [] },
					levels: { nodes: [] },
				},
			},
		})
	})
	await openPage(page, '/wiki')
	const input = page.locator('#desktop-omni-search')
	await input.fill('Motion')
	const options = page.getByRole('option')
	await expect(options).toHaveCount(2)
	await input.press('ArrowDown')
	await input.press('ArrowDown')
	await expect(page.locator('[role="option"][data-highlighted]')).toHaveCount(1)
	for (const option of await options.all()) {
		await expect(option).toHaveCSS('transition-property', 'none')
		expect(
			await option.evaluate(
				(element) => getComputedStyle(element, '::before').transitionProperty,
			),
		).toBe('none')
	}
})

test('Sortable follows preference changes and list recreation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await openPage(page, '/playlist')
	await importPlaylist(page)
	await expect.poll(() => sortableDuration(page)).toBe(0)
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await expect.poll(() => sortableDuration(page)).toBe(150)
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await expect.poll(() => sortableDuration(page)).toBe(0)
	await page.getByRole('button', { name: 'Remove level', exact: true }).first().click()
	await page.getByRole('button', { name: 'Remove level', exact: true }).first().click()
	await expect(page.locator('[data-uid]')).toHaveCount(0)
	await importPlaylist(page)
	await expect.poll(() => sortableDuration(page)).toBe(0)
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await expect.poll(() => sortableDuration(page)).toBe(150)
})

test('mobile pane reveal cancels cleanly during rapid switches, preference changes and resize', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.addInitScript(() => {
		const original = Element.prototype.animate
		Element.prototype.animate = function (...args: Parameters<typeof original>) {
			const animation = original.apply(this, args)
			if (this instanceof HTMLElement && this.dataset.testid?.endsWith('-pane'))
				animation.playbackRate = 0.1
			return animation
		}
	})
	await openPage(page, '/playlist')
	const playlist = page.getByTestId('playlist-pane')
	const browser = page.getByTestId('browser-pane')
	const playlistButton = page.getByRole('button', { name: 'Playlist', exact: true })
	const browserButton = page.getByRole('button', { name: 'Find levels', exact: true })
	await expect(playlist).toBeVisible()
	await expect(browser).toBeHidden()
	await browserButton.click()
	await expect.poll(() => paneAnimations(page)).toBe(1)
	await expect(browserButton).toBeFocused()
	const timing = await browser.evaluate((element) =>
		element.getAnimations()[0]?.effect?.getTiming(),
	)
	expect(timing?.duration).toBe(125)
	expect(timing?.easing).toBe('cubic-bezier(0.23, 1, 0.32, 1)')
	await page.screenshot({ path: testInfo.outputPath('mobile-pane-slow.png') })
	await playlistButton.click()
	await expect(browser).toBeHidden()
	await expect.poll(() => paneAnimations(page)).toBe(0)
	await browserButton.click()
	await expect.poll(() => paneAnimations(page)).toBe(1)
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await expect.poll(() => paneAnimations(page)).toBe(0)
	await expect(browser).toHaveCSS('opacity', '1')
	await playlistButton.click()
	await browserButton.click()
	await expect.poll(() => paneAnimations(page)).toBe(0)
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await playlistButton.focus()
	await playlistButton.press('Enter')
	await expect(playlist).toBeVisible()
	expect(await playlist.evaluate((element) => element.getAnimations().length)).toBe(0)
	await browserButton.click()
	await expect.poll(() => paneAnimations(page)).toBe(1)
	await page.setViewportSize({ width: 1280, height: 900 })
	await expect.poll(() => paneAnimations(page)).toBe(0)
	await expect(playlist).toBeVisible()
	await expect(browser).toBeVisible()
})

test('mobile pane switching works without WAAPI', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await openPage(page, '/playlist')
	await expect(page.getByTestId('playlist-pane')).toBeVisible()
	await page.evaluate(() => {
		Object.defineProperty(Element.prototype, 'animate', {
			value: undefined,
			configurable: true,
		})
	})
	await page.getByRole('button', { name: 'Find levels', exact: true }).click()
	await expect(page.getByTestId('browser-pane')).toBeVisible()
	await expect(page.getByTestId('playlist-pane')).toBeHidden()
})

test('touch activation keeps playlist action responsive without sticky scale', async ({
	page,
	isMobile,
}) => {
	test.skip(!isMobile, 'Requires touch emulation')
	await openPage(page, '/level/fixture-hydration-level')
	const add = page.getByRole('button', { name: 'Add to playlist', exact: true })
	await expect(add).toBeEnabled()
	await add.tap()
	const remove = page.getByRole('button', { name: 'Remove from playlist', exact: true })
	await expect(remove).toBeEnabled()
	await expect(remove).toHaveCSS('scale', 'none')
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await remove.tap()
	await expect(add).toBeEnabled()
	await expect(add).toHaveCSS('scale', 'none')
})
