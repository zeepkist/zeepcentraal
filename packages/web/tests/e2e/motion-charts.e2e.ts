import { expect } from '@playwright/test'
import { test } from '../support/browser'

test('mounted charts follow live reduced motion while period data changes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.route('**/graphql', async (route) => {
		if (!String(route.request().postDataJSON()?.query).includes('ZC_DashboardStatistics'))
			return route.fallback()
		const statistics = (grass: number) => ({
			aggregates: {
				sum: {
					distance: 100,
					distanceOnGrass: grass,
					distanceOnTarmac: 100 - grass,
					time: 100,
					timeOnGrass: grass,
					timeOnTarmac: 100 - grass,
				},
			},
		})
		await route.fulfill({
			json: {
				data: {
					allTimeStatistics: statistics(40),
					dayStatistics: statistics(40),
					monthStatistics: statistics(80),
					v6DayStatistics: statistics(40),
					v6MonthStatistics: statistics(80),
				},
			},
		})
	})
	await page.goto('/', { waitUntil: 'domcontentloaded' })
	await page.waitForFunction(() => {
		const root = document.querySelector('#__nuxt') as Element & {
			__vue_app__?: { config: { globalProperties: { $nuxt?: { isHydrating: boolean } } } }
		}
		return root?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false
	})
	const statistics = page.locator('[data-prefetch="dashboard-statistics"]')
	await statistics.scrollIntoViewIfNeeded()
	const chart = statistics.locator('.telemetry-donut').first()
	await expect(chart.locator('svg path').first()).toBeVisible()
	const monthLabel = new Intl.DateTimeFormat('en-GB', {
		month: 'long',
		timeZone: 'Europe/London',
	}).format(new Date())
	const month = statistics.getByRole('button', { name: monthLabel, exact: true })
	const today = statistics.getByRole('button', { name: 'Today', exact: true })
	const paths = () =>
		chart
			.locator('svg path')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('d')))
	// Sample rendered paths after two frames, then past the normal 650ms duration.
	const nextFrames = () =>
		page.evaluate(
			() =>
				new Promise<void>((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
				),
		)
	await month.click()
	await nextFrames()
	const reduced = await paths()
	await page.waitForTimeout(700)
	expect(await paths()).toEqual(reduced)
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await today.click()
	await nextFrames()
	const moving = await paths()
	await expect.poll(paths).not.toEqual(moving)
	await page.waitForTimeout(700)
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await month.click()
	await nextFrames()
	const reducedAgain = await paths()
	await page.waitForTimeout(700)
	expect(await paths()).toEqual(reducedAgain)
	await chart.scrollIntoViewIfNeeded()
	const point = await chart
		.locator('path.v-charts-sector')
		.first()
		.evaluate((element) => {
			const path = element as SVGPathElement
			const bounds = path.getBBox()
			const matrix = path.getScreenCTM()
			if (!matrix) throw new Error('Donut sector has no screen transform')
			for (let y = 0.1; y < 1; y += 0.2) {
				for (let x = 0.1; x < 1; x += 0.2) {
					const local = new DOMPoint(
						bounds.x + bounds.width * x,
						bounds.y + bounds.height * y,
					)
					if (!path.isPointInFill(local)) continue
					const screen = local.matrixTransform(matrix)
					const point = { x: Math.round(screen.x), y: Math.round(screen.y) }
					if (document.elementFromPoint(point.x, point.y) !== path) continue
					return point
				}
			}
			throw new Error('Donut sector has no hoverable interior')
		})
	await page.mouse.move(point.x, point.y)
	await expect(page.getByRole('tooltip')).toBeVisible()
	await expect(page.getByRole('tooltip')).toContainText(/20%|80%/)
	await page.mouse.move(0, 0)
	await expect(page.getByRole('tooltip')).toHaveCount(0)
})
