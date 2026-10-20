import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

type FixtureWindow = Window & {
	dataStateFixture: {
		settle: (result?: string) => Promise<void>
		pending: () => Promise<void>
		change: (action: string) => Promise<void>
		interrupt: () => Promise<void>
	}
	reveals: { animation: Animation; target: Element }[]
}

async function captureReveals(page: Page) {
	await page.addInitScript(() => {
		const state = window as unknown as FixtureWindow
		state.reveals = []
		const animate = Element.prototype.animate
		Element.prototype.animate = function (frames, options) {
			const animation = animate.call(this, frames, options)
			if (
				Array.isArray(frames) &&
				frames.length === 2 &&
				(frames[0]?.opacity === 0 || frames[0]?.opacity === 0.85) &&
				frames[1]?.opacity === 1
			) {
				animation.pause()
				animation.currentTime = 0
				state.reveals.push({ animation, target: this })
			}
			return animation
		}
	})
}

async function openPage(page: Page, path: string) {
	await page.goto(path, { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function fixture(page: Page, mode = 'pending') {
	await captureReveals(page)
	await openPage(page, `/motion-data-state?mode=${mode}`)
	await page.waitForFunction(() => Boolean((window as unknown as FixtureWindow).dataStateFixture))
}

async function settle(page: Page, result = 'success') {
	await page.evaluate(
		(result) => (window as unknown as FixtureWindow).dataStateFixture.settle(result),
		result,
	)
}

async function revealCount(page: Page) {
	return page.evaluate(() => (window as unknown as FixtureWindow).reveals.length)
}

async function effect(page: Page) {
	return page.evaluate(() => {
		const entry = (window as unknown as FixtureWindow).reveals[0]
		const effect = entry?.animation.effect as KeyframeEffect | null
		const timing = effect?.getTiming()
		// WebKit serializes this exact cubic-bezier as its equivalent CSS keyword.
		if (timing?.easing === 'ease') timing.easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)'
		return {
			frames: effect
				?.getKeyframes()
				.map((frame) => ({ opacity: frame.opacity, transform: frame.transform })),
			timing,
			state: entry?.animation.playState,
		}
	})
}

test.describe('DataState isolated contract', () => {
	test.skip(
		process.env.PLAYWRIGHT_HYDRATION_RUNTIME !== 'development',
		'Development fixture only',
	)

	test('first success reveals once; focus and content remain interactive', async ({
		page,
	}, testInfo) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' })
		await fixture(page)
		await expect(page.getByRole('status', { name: 'Fixture loading' })).toHaveCount(1)
		await page.getByLabel('Focus sentinel').focus()
		await settle(page)
		await expect.poll(() => revealCount(page)).toBe(1)
		await expect(page.getByLabel('Focus sentinel')).toBeFocused()
		await expect(page.getByRole('status', { name: 'Fixture loading' })).toHaveCount(0)
		const reveal = await effect(page)
		expect(reveal.frames).toEqual([
			{ opacity: '0', transform: undefined },
			{ opacity: '1', transform: undefined },
		])
		expect(reveal.timing).toMatchObject({
			duration: 125,
			easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
			fill: 'auto',
		})
		await page.evaluate(() => {
			const animation = (window as unknown as FixtureWindow).reveals[0]?.animation
			if (animation) {
				animation.playbackRate = 0.1
				animation.currentTime = 62.5
			}
		})
		const wrapper = page.getByTestId('fixture-content').locator('..')
		const midpoint = Number(
			await wrapper.evaluate((element) => getComputedStyle(element).opacity),
		)
		expect(midpoint).toBeGreaterThan(0)
		expect(midpoint).toBeLessThan(1)
		await page.screenshot({ path: testInfo.outputPath('initial-reveal-midpoint.png') })
		await testInfo.attach('initial-reveal-midpoint', {
			path: testInfo.outputPath('initial-reveal-midpoint.png'),
			contentType: 'image/png',
		})
		await page.getByLabel('Content input').fill('still interactive')
		await page.evaluate(() =>
			(window as unknown as FixtureWindow).dataStateFixture.change('update'),
		)
		await expect(page.getByLabel('Content input')).toBeFocused()
		await expect(page.getByLabel('Content input')).toHaveValue('still interactive')
		await page.getByRole('link', { name: 'Fixture link' }).click()
		await expect(page).toHaveURL(/#fixture-destination$/)
		await page.evaluate(() =>
			(window as unknown as FixtureWindow).reveals[0]?.animation.finish(),
		)
		await expect(wrapper).toHaveCSS('opacity', '1')
		await page.evaluate(() => (window as unknown as FixtureWindow).dataStateFixture.pending())
		await settle(page)
		expect(await revealCount(page)).toBe(1)
	})

	for (const mode of ['default', 'ready']) {
		test(`${mode} never reveals on hydration or later loads`, async ({ page }) => {
			await fixture(page, mode)
			if (mode === 'default') await settle(page)
			await expect(page.getByTestId('fixture-content')).toBeVisible()
			if (mode === 'default') {
				await expect(page.getByTestId('fixture-content').locator('..')).toHaveAttribute(
					'data-testid',
					'fixture-state',
				)
			}
			await page.evaluate(() =>
				(window as unknown as FixtureWindow).dataStateFixture.pending(),
			)
			await settle(page)
			expect(await revealCount(page)).toBe(0)
		})
	}

	for (const result of ['error', 'empty']) {
		test(`initial ${result} consumes reveal before retry`, async ({ page }) => {
			await fixture(page)
			await settle(page, result)
			await expect(
				page.getByText(result === 'error' ? 'Fixture failed' : 'Fixture empty', {
					exact: true,
				}),
			).toBeVisible()
			await page.evaluate(() =>
				(window as unknown as FixtureWindow).dataStateFixture.pending(),
			)
			await settle(page)
			await expect(page.getByTestId('fixture-content')).toBeVisible()
			expect(await revealCount(page)).toBe(0)
		})
	}

	for (const action of ['pending', 'opt-out', 'unmount', 'error', 'empty', 'preference']) {
		test(`${action} cancels running reveal without replay`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'no-preference' })
			await fixture(page)
			await settle(page)
			await expect.poll(() => revealCount(page)).toBe(1)
			if (action === 'preference') await page.emulateMedia({ reducedMotion: 'reduce' })
			else if (action === 'pending')
				await page.evaluate(() =>
					(window as unknown as FixtureWindow).dataStateFixture.pending(),
				)
			else
				await page.evaluate(
					(action) =>
						(window as unknown as FixtureWindow).dataStateFixture.change(action),
					action,
				)
			await expect.poll(async () => (await effect(page)).state).toBe('idle')
			if (action !== 'unmount') {
				await settle(page)
				await expect(page.getByTestId('fixture-content').locator('..')).toHaveCSS(
					'opacity',
					'1',
				)
			}
			expect(await revealCount(page)).toBe(1)
		})
	}

	test('reduced preference uses stationary gentle opacity reveal', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await fixture(page)
		await settle(page)
		await expect.poll(() => revealCount(page)).toBe(1)
		const reveal = await effect(page)
		expect(reveal.frames).toEqual([
			{ opacity: '0.85', transform: undefined },
			{ opacity: '1', transform: undefined },
		])
		expect(reveal.timing).toMatchObject({
			duration: 125,
			easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
		})
	})

	for (const fallback of [
		'missing-waapi',
		'hidden',
		'offscreen',
		'invalid-duration',
		'missing-easing',
	]) {
		test(`${fallback} leaves content visible without reveal`, async ({ page }) => {
			await fixture(page)
			await page.getByTestId('fixture-state').evaluate((element, fallback) => {
				if (fallback === 'missing-waapi')
					Object.defineProperty(Element.prototype, 'animate', { value: undefined })
				if (fallback === 'hidden') element.style.display = 'none'
				if (fallback === 'offscreen') element.style.marginTop = '200vh'
				if (fallback === 'invalid-duration')
					element.style.setProperty('--duration-feedback', 'invalid')
				if (fallback === 'missing-easing') element.style.setProperty('--ease-out', ' ')
			}, fallback)
			await settle(page)
			expect(await revealCount(page)).toBe(0)
			await page
				.getByTestId('fixture-state')
				.evaluate((element) => element.removeAttribute('style'))
			await page.getByTestId('fixture-content').scrollIntoViewIfNeeded()
			await expect(page.getByTestId('fixture-content').locator('..')).toHaveCSS(
				'opacity',
				'1',
			)
		})
	}

	test('interrupted settlement leaves no running animation and never rearms', async ({
		page,
	}) => {
		await fixture(page)
		await page.evaluate(() => (window as unknown as FixtureWindow).dataStateFixture.interrupt())
		await settle(page)
		await expect(page.getByTestId('fixture-content').locator('..')).toHaveCSS('opacity', '1')
		const count = await revealCount(page)
		expect(count).toBeLessThanOrEqual(1)
		if (count) expect((await effect(page)).state).toBe('idle')
	})
})

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	test(`Steam news alone reveals on deferred first load (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion })
		await captureReveals(page)
		let release = () => {}
		const response = new Promise<void>((resolve) => {
			release = resolve
		})
		let requested = () => {}
		const request = new Promise<void>((resolve) => {
			requested = resolve
		})
		await page.route('**/api/steam-news', async (route) => {
			requested()
			await response
			await route.fulfill({
				json: [
					{
						id: '9001',
						title: 'Fixture Steam news',
						author: 'Fixture author',
						url: 'https://store.steampowered.com/app/1440670/',
						date: '2026-10-01T00:00:00Z',
						contents: 'Deterministic Steam news body',
					},
				],
			})
		})
		await openPage(page, '/')
		const news = page.locator('section[aria-labelledby="steam-news-heading"]')
		await page.locator('#steam-news-heading').scrollIntoViewIfNeeded()
		await request
		await expect(news.getByRole('status')).toHaveCount(1)
		release()
		await expect(news.getByRole('heading', { name: 'Fixture Steam news' })).toBeVisible()
		await expect.poll(() => revealCount(page)).toBe(1)
		const reveal = await effect(page)
		expect(reveal.timing).toMatchObject({
			duration: 125,
			easing:
				reducedMotion === 'reduce'
					? 'cubic-bezier(0.25, 0.1, 0.25, 1)'
					: 'cubic-bezier(0.23, 1, 0.32, 1)',
		})
		expect(reveal.frames?.map((frame) => frame.opacity)).toEqual([
			reducedMotion === 'reduce' ? '0.85' : '0',
			'1',
		])
		expect(
			await page.evaluate(() =>
				(window as unknown as FixtureWindow).reveals.every(
					({ target }) =>
						target.closest('section')?.getAttribute('aria-labelledby') ===
						'steam-news-heading',
				),
			),
		).toBe(true)
		expect(await news.locator('.grid.md\\:grid-cols-2').count()).toBe(1)
		await page.evaluate(() =>
			(window as unknown as FixtureWindow).reveals[0]?.animation.finish(),
		)
		await expect(
			news.getByRole('heading', { name: 'Fixture Steam news' }).locator('../..'),
		).toHaveCSS('opacity', '1')
	})
}
