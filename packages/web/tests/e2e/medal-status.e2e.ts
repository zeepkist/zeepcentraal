import { expect, type Page } from '@playwright/test'
import { test } from '../support/browser'

test.setTimeout(90_000)

async function waitForHydration(page: Page) {
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
}

async function navigate(page: Page, path: string) {
	await page.evaluate(async (to) => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: {
				config: {
					globalProperties: { $router: { push: (path: string) => Promise<unknown> } }
				}
			}
		}
		await root.__vue_app__?.config.globalProperties.$router.push(to)
	}, path)
	await waitForHydration(page)
}

test('locked medals show remaining Author PBs and fit narrow cards', async ({ page }) => {
	for (const [count, expected] of [
		[0, '10 Author medals to unlock'],
		[7, '3 Author medals to unlock'],
		[9, '1 Author medal to unlock'],
		[10, '0 Author medals to unlock'],
		[12, '0 Author medals to unlock'],
	] as const) {
		const path = `/level/medal-fixture-level-locked-${count}`
		if (count === 0) await page.goto(path)
		else await navigate(page, path)
		await waitForHydration(page)
		const section = page.locator('section[aria-labelledby="medals-heading"]')
		await expect(section.getByText(expected, { exact: true })).toHaveCount(2)
		await expect(section.getByText('0:40.000', { exact: true })).toBeVisible()
		await page.setViewportSize({ width: 320, height: 900 })
		expect(
			await section.evaluate((element) => element.scrollWidth <= element.clientWidth),
		).toBe(true)
		const images = section.locator('img')
		expect(
			await images.evaluateAll((elements) =>
				elements.every((element) => element.getBoundingClientRect().width === 48),
			),
		).toBe(true)
	}
})

test('settling medals tick locally each minute and become Calculating', async ({ page }) => {
	await page.clock.install()
	const response = await page.goto('/level/medal-fixture-level-settling')
	expect(await response?.text()).toContain('Settles in 3d 5h 28m')
	await waitForHydration(page)
	const section = page.locator('section[aria-labelledby="medals-heading"]')
	await expect(section.getByText('Settles in 3d 5h 28m', { exact: true })).toHaveCount(2)
	await page.waitForLoadState('networkidle')
	let requests = 0
	page.on('request', (request) => {
		if (request.url().includes('/graphql')) requests++
	})
	await page.clock.fastForward(60_000)
	await expect(section.getByText('Settles in 3d 5h 27m', { exact: true })).toHaveCount(2)
	await page.clock.fastForward(4647 * 60_000)
	await expect(section.getByText('Calculating', { exact: true })).toHaveCount(2)
	expect(requests).toBe(0)
})

test('expired deadlines show Calculating and calculated medals keep times', async ({ page }) => {
	await page.goto('/level/medal-fixture-level-calculating')
	await waitForHydration(page)
	const section = page.locator('section[aria-labelledby="medals-heading"]')
	await expect(section.getByText('Calculating', { exact: true })).toHaveCount(2)
	await navigate(page, '/level/medal-fixture-level')
	await waitForHydration(page)
	await expect(section.getByText('0:36.433', { exact: true })).toBeVisible()
	await expect(section.getByText('0:38.251', { exact: true })).toBeVisible()
})

test('SSR countdown hydrates across a minute boundary', async ({ page }) => {
	await page.clock.setFixedTime(new Date(Date.now() + 61_000))
	const response = await page.goto('/level/medal-fixture-level-settling')
	expect(await response?.text()).toContain('Settles in 3d 5h 28m')
	await waitForHydration(page)
	const section = page.locator('section[aria-labelledby="medals-heading"]')
	await expect(section.getByText('Settles in 3d 5h 27m', { exact: true })).toHaveCount(2)
	await navigate(page, '/level/medal-fixture-level-calculating')
	await expect(section.getByText('Calculating', { exact: true })).toHaveCount(2)
})
