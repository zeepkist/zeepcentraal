import { expect, test } from '@playwright/test'

test.skip(process.env.ZC_LOBBY_TEST !== '1', 'Requires isolated lobby GraphQL fixture server')

test.beforeAll(async ({ request }) => {
	for (const [path, marker] of [
		['/lobby', 'Test active room'],
		['/lobby/history', 'Private midnight room'],
		['/lobby/stats', 'Sample averages describe recorded changes'],
		['/lobby/1001', 'Original room name'],
	] as const) {
		await expect
			.poll(async () => (await (await request.get(path)).text()).includes(marker), {
				timeout: 120_000,
			})
			.toBe(true)
	}
})

test('live lobby subscriptions update without HTTP polling and pause when hidden', async ({
	page,
	request,
}, info) => {
	test.skip(info.project.name !== 'chromium')
	const frames: string[] = []
	const httpRequests: string[] = []
	page.on('request', (request) => {
		if (request.url() === 'http://127.0.0.1:55440/') httpRequests.push(request.url())
	})
	page.on('websocket', (socket) =>
		socket.on('framesent', (frame) => {
			frames.push(String(frame.payload))
		}),
	)
	await page.goto('/lobby')
	await expect(page.getByRole('link', { name: 'Test active room', exact: true })).toBeVisible()
	await expect
		.poll(() => frames.filter((frame) => frame.includes('"type":"subscribe"')).length)
		.toBeGreaterThanOrEqual(2)
	const row = page
		.getByRole('row')
		.filter({ has: page.getByRole('link', { name: 'Test active room', exact: true }) })
	const before = await row.innerText()
	await request.post('http://127.0.0.1:55440/__test/update')
	await expect.poll(() => row.innerText()).not.toBe(before)
	const completed = frames.filter((frame) => frame.includes('"type":"complete"')).length
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'hidden',
		})
		document.dispatchEvent(new Event('visibilitychange'))
	})
	await expect
		.poll(() => frames.filter((frame) => frame.includes('"type":"complete"')).length)
		.toBeGreaterThan(completed)
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible',
		})
		document.dispatchEvent(new Event('visibilitychange'))
	})
	await expect(page.getByText('Connecting to live updates', { exact: true })).toHaveCount(0)
	const requests = httpRequests.length
	await page.waitForTimeout(31_000)
	expect(httpRequests.length).toBe(requests)
})

test('history filters, stable details, timeline and event pagination render', async ({
	page,
}, info) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto('/lobby/history')
	await expect(
		page.getByRole('link', { name: 'Private midnight room', exact: true }),
	).toBeVisible()
	await page.getByLabel('Room name', { exact: true }).fill('MIDNIGHT')
	await page.getByLabel('Active from', { exact: true }).fill('2001-01-02')
	await page.getByLabel('Active through', { exact: true }).fill('2001-01-02')
	await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
	await expect(page).toHaveURL(/q=MIDNIGHT/)
	await page.getByRole('link', { name: 'Private midnight room', exact: true }).click()
	await expect(page).toHaveURL(/\/lobby\/1002$/)
	await expect(
		page.getByRole('heading', { name: 'Room occupancy history', exact: true }),
	).toBeVisible()
	await expect(page.getByRole('cell').filter({ hasText: 'Closure observed' })).toBeVisible()
	await page.goto('/lobby/1001')
	await expect(page.getByRole('heading', { name: 'Recorded changes', exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await expect(page).toHaveURL(/after=/)
	await expect(page.getByRole('heading', { name: 'Test active room', exact: true })).toBeVisible()
	await page.screenshot({
		path: info.outputPath('detail.png'),
		fullPage: true,
	})
	expect(errors).toEqual([])
})

test('statistics and live charts render with local timestamps and responsive layout', async ({
	page,
}, info) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.goto('/lobby/stats')
	await expect(page.getByRole('heading', { name: 'Player activity', exact: true })).toBeVisible()
	await page.getByLabel('Activity range', { exact: true }).selectOption('7d')
	await expect(page).toHaveURL(/range=7d/)
	await expect(
		page.getByRole('heading', { name: 'Daily player trends (UTC days)', exact: true }),
	).toBeVisible()
	await page
		.getByRole('button', { name: 'Online players (sample average)', exact: true })
		.first()
		.click()
	await expect(
		page.getByRole('button', { name: 'Online players (sample average)', exact: true }).first(),
	).toHaveAttribute('aria-pressed', 'false')
	await page.screenshot({
		path: info.outputPath('stats.png'),
		fullPage: true,
	})
	await page.goto('/lobby')
	await expect(page.getByText('Players Outside Rooms', { exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Player activity', exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Test active room', exact: true })).toBeVisible()
	await page.screenshot({
		path: info.outputPath('live.png'),
		fullPage: true,
	})
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
	).toBe(true)
	expect(errors).toEqual([])
})
