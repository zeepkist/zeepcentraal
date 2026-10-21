import { expect, test } from '@playwright/test'

test('SSR metrics stay fixed through writes, focus, reconnect, and midnight until refresh', async ({
	page,
	request,
}) => {
	const metricSubscriptions: string[] = []
	page.on('websocket', (socket) =>
		socket.on('framesent', (frame) => {
			const payload = String(frame.payload)
			if (payload.includes('globalMetrics') || payload.includes('ZC_DashboardMetricsLive'))
				metricSubscriptions.push(payload)
		}),
	)
	await page.clock.install()
	await page.goto('/')
	const metrics = page.getByTestId('homepage-metrics')
	const records = metrics.getByText('Records', { exact: true }).locator('..').locator('p.tabular')
	await expect(records).toHaveText('4')
	await expect(metrics.getByText('Today', { exact: true }).first()).toBeVisible()
	const before = await metrics.innerText()
	const initialRequests = await (
		await request.get('http://127.0.0.1:55440/__test/requests')
	).json()
	expect(initialRequests.metricRequests).toBe(1)
	await request.post('http://127.0.0.1:55440/__test/advance')
	await page.context().setOffline(true)
	await page.context().setOffline(false)
	await page.evaluate(() => {
		window.dispatchEvent(new Event('focus'))
		document.dispatchEvent(new Event('visibilitychange'))
	})
	await page.clock.setSystemTime(new Date('2026-11-01T12:00:00Z'))
	await page.clock.runFor(120_000)
	await expect(metrics).toHaveText(before.replace(/\s+/g, ' ').trim(), { useInnerText: true })
	expect(
		(await (await request.get('http://127.0.0.1:55440/__test/requests')).json()).metricRequests,
	).toBe(1)
	expect(metricSubscriptions).toEqual([])
	await page.reload()
	await expect(records).toHaveText('5')
	expect(
		(await (await request.get('http://127.0.0.1:55440/__test/requests')).json()).metricRequests,
	).toBe(2)
})

for (const width of [375, 1440]) {
	test(`headline cards show four matching periods at ${width}px`, async ({ page, request }) => {
		await page.setViewportSize({ width, height: 1000 })
		await page.goto('/')
		const metrics = page.getByTestId('homepage-metrics')
		const response = await request.post('http://127.0.0.1:55440/', {
			data: { query: '{ globalMetrics { monthStart lastMonthStart } }' },
		})
		const snapshot = (await response.json()).data.globalMetrics
		const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'Europe/London' })
		const expected = [
			'Today',
			'Yesterday',
			month.format(new Date(snapshot.monthStart)),
			month.format(new Date(snapshot.lastMonthStart)),
		]
		const cards = metrics.locator('dl')
		await expect(cards).toHaveCount(6)
		for (const card of await cards.all()) {
			const labels = await card.locator('dt').allTextContents()
			expect(labels.map((label) => label.trim())).toEqual(expected)
			await expect(card.locator('dd')).toHaveCount(4)
			expect(
				await card.evaluate((element) => element.scrollWidth <= element.clientWidth),
			).toBe(true)
		}
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
		).toBe(true)
		await metrics.screenshot({ path: test.info().outputPath(`headline-${width}.png`) })
	})
}

test('homepage OG image renders cached metrics', async ({ page, request }) => {
	await page.goto('/')
	const image = await page.locator('meta[property="og:image"]').getAttribute('content')
	expect(image).toBeTruthy()
	if (!image) throw new Error('Missing homepage OG image')
	const width = Number(
		await page.locator('meta[property="og:image:width"]').getAttribute('content'),
	)
	const height = Number(
		await page.locator('meta[property="og:image:height"]').getAttribute('content'),
	)
	expect(width).toBeGreaterThan(0)
	expect(height).toBeGreaterThan(0)
	const url = new URL(image, 'http://127.0.0.1:4174')
	const response = await request.get(`http://127.0.0.1:4174${url.pathname}${url.search}`)
	expect(response.status()).toBe(200)
	expect(response.headers()['content-type']).toContain('image/png')
	const bytes = await response.body()
	expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
	expect(bytes.readUInt32BE(16)).toBe(width)
	expect(bytes.readUInt32BE(20)).toBe(height)
})
