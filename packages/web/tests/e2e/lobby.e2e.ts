import { expect, test } from '@playwright/test'

test.skip(process.env.ZC_LOBBY_TEST !== '1', 'Requires isolated lobby GraphQL fixture server')

test.beforeAll(async ({ request }) => {
	for (const [path, marker] of [
		['/lobby', 'Test active room'],
		['/lobby/history?visibility=all', 'Private midnight room'],
		['/lobby/stats', 'Player activity'],
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
	const liveCards = page.getByTestId('lobby-live-cards')
	await expect(liveCards).toBeVisible()
	await liveCards.evaluate((element) => {
		element.setAttribute('data-retained', 'true')
	})
	await expect(
		page.getByRole('button', { name: 'Peak online players', exact: true }),
	).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Peak players in rooms', exact: true }),
	).toBeVisible()
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
	await expect(liveCards).toHaveAttribute('data-retained', 'true')
	await expect(
		page.getByText('No recent update; collection health unknown', { exact: true }),
	).toHaveCount(0)
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
	await expect(page.getByRole('combobox', { name: 'Visibility', exact: true })).toHaveValue(
		'public',
	)
	await expect(
		page.getByRole('link', { name: 'Private midnight room', exact: true }),
	).toHaveCount(0)
	await page.getByRole('combobox', { name: 'Visibility', exact: true }).selectOption('all')
	await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
	await expect(page).toHaveURL(/visibility=all/)
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

test('cards and legends persist while selections load; gaps and themes render', async ({
	page,
}, info) => {
	let held = false
	const pendingRequests: Array<() => void> = []
	const pendingPackets: Array<() => void> = []
	await page.route('http://127.0.0.1:55440/', async (route) => {
		if (held) await new Promise<void>((resolve) => pendingRequests.push(resolve))
		await route.continue()
	})
	await page.routeWebSocket('ws://127.0.0.1:55440/', (socket) => {
		const server = socket.connectToServer()
		server.onMessage((message) => {
			if (held && typeof message === 'string' && message.includes('"type":"next"'))
				pendingPackets.push(() => socket.send(message))
			else socket.send(message)
		})
	})
	await page.goto('/lobby/history')
	held = true
	try {
		await page.getByRole('link', { name: 'Statistics', exact: true }).click()
		const initialCards = page.getByTestId('lobby-peak-cards')
		await expect(initialCards).toBeVisible()
		await expect(initialCards.locator(':scope > div')).toHaveCount(4)
		await expect(initialCards.locator('time')).toHaveCount(0)
		await initialCards.locator(':scope > div').evaluateAll((elements) => {
			for (const element of elements) element.setAttribute('data-retained-card', 'true')
		})
	} finally {
		held = false
		pendingRequests.splice(0).forEach((release) => {
			release()
		})
		pendingPackets.splice(0).forEach((release) => {
			release()
		})
	}
	const cards = page.getByTestId('lobby-peak-cards')
	await expect(cards.locator('time')).toHaveCount(4)
	await expect(cards.locator('[data-retained-card="true"]')).toHaveCount(4)
	await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
	await cards.evaluate((element) => {
		element.setAttribute('data-retained', 'true')
	})
	const before = await cards.innerText()
	const legend = page
		.getByRole('button', { name: 'Online players (sample average)', exact: true })
		.first()
	await legend.click()
	held = true
	try {
		await page.getByLabel('Activity range', { exact: true }).selectOption('all')
		await expect(page.locator('[aria-busy="true"]')).toBeVisible()
		await expect(cards).toHaveAttribute('data-retained', 'true')
		expect(await cards.innerText()).toBe(before)
		await expect(legend).toHaveAttribute('aria-pressed', 'false')
	} finally {
		held = false
		pendingRequests.splice(0).forEach((release) => {
			release()
		})
		pendingPackets.splice(0).forEach((release) => {
			release()
		})
	}
	await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
	await expect(cards).toHaveAttribute('data-retained', 'true')
	await expect(legend).toHaveAttribute('aria-pressed', 'false')
	await expect(page.locator('path[stroke-dasharray="2 4"]').first()).toBeVisible()
	await expect(page.locator('details')).toHaveCount(0)
	await expect(
		page.getByText(/Last recorded observation|Connecting to live updates|Observed peak/),
	).toHaveCount(0)
	for (const value of await cards.locator('time').allTextContents()) {
		expect(value).toMatch(/\d{2}:\d{2}/)
		expect(value).not.toMatch(/\d{2}:\d{2}:\d{2}|\b(?:AM|PM|GMT|UTC)\b/)
	}
	await page.goto('/lobby/1001')
	for (const theme of ['light', 'dark']) {
		await page.evaluate((value) => {
			document.documentElement.classList.remove('light', 'dark')
			document.documentElement.classList.add(value)
		}, theme)
		const chart = page.locator('.lobby-chart')
		await expect(chart.locator('path.v-charts-line-curve').first()).toBeVisible()
		await chart
			.locator('svg')
			.first()
			.hover({ position: { x: 200, y: 100 } })
		const tooltip = chart.locator('.min-w-48')
		await expect(tooltip).toBeVisible()
		const tooltipColors = await tooltip.evaluate((element) => {
			const style = getComputedStyle(element)
			return { background: style.backgroundColor, foreground: style.color }
		})
		expect(tooltipColors.background).not.toBe('rgba(0, 0, 0, 0)')
		expect(tooltipColors.foreground).not.toBe(tooltipColors.background)
		const colors = await chart.evaluate((element) => {
			const line = element.querySelector('path.v-charts-line-curve')
			return {
				background: getComputedStyle(element).backgroundColor,
				stroke: line && getComputedStyle(line).stroke,
			}
		})
		expect(colors.stroke).toBeTruthy()
		expect(colors.stroke).not.toBe(colors.background)
		await chart.screenshot({ path: info.outputPath(`occupancy-${theme}.png`) })
	}
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
