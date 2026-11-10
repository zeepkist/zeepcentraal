import { expect, test } from '@playwright/test'
import { sparseLobbyStatistics } from '../fixtures/lobby-performance'

test.skip(
	process.env.ZC_LOBBY_TEST !== '1' && process.env.ZC_LOBBY_PERFORMANCE_TEST !== '1',
	'Requires a running web application',
)

declare global {
	interface Window {
		__lobbyPerformance: {
			date: number
			number: number
			maxLag: number
			intervals: Record<string, number>
		}
	}
}

test('sparse charts keep bounded series, correct domains and disposable subscriptions and clocks', async ({
	page,
}, info) => {
	const active = new Map<string, (update?: number) => void>()
	await page.addInitScript(() => {
		const state = {
			date: 0,
			number: 0,
			maxLag: 0,
			intervals: {} as Record<string, number>,
		}
		window.__lobbyPerformance = state
		for (const [name, key] of [
			['DateTimeFormat', 'date'],
			['NumberFormat', 'number'],
		] as const) {
			Intl[name] = new Proxy(Intl[name], {
				construct(target, args, newTarget) {
					state[key]++
					return Reflect.construct(target, args, newTarget)
				},
			})
		}
		const originalInterval = window.setInterval
		window.setInterval = new Proxy(originalInterval, {
			apply(target, receiver, args) {
				const id = Reflect.apply(target, receiver, args)
				state.intervals[String(id)] = Number(args[1])
				return id
			},
		})
		window.clearInterval = new Proxy(window.clearInterval, {
			apply(target, receiver, args) {
				delete state.intervals[String(args[0])]
				return Reflect.apply(target, receiver, args)
			},
		})
		let last = performance.now()
		originalInterval(() => {
			const now = performance.now()
			state.maxLag = Math.max(state.maxLag, now - last - 50)
			last = now
		}, 50)
	})
	await page.routeWebSocket(/graphql|55440/, (socket) => {
		const ownIds = new Set<string>()
		socket.onMessage((message) => {
			const packet = JSON.parse(String(message)) as {
				type: string
				id?: string
				payload?: { query?: string }
			}
			if (packet.type === 'connection_init') {
				socket.send(JSON.stringify({ type: 'connection_ack' }))
			} else if (packet.type === 'ping') {
				socket.send(JSON.stringify({ type: 'pong' }))
			} else if (
				packet.id &&
				packet.type === 'subscribe' &&
				packet.payload?.query?.includes('ZC_LobbyStatisticsLive')
			) {
				const id = packet.id
				ownIds.add(id)
				const send = (update = 0) =>
					socket.send(
						JSON.stringify({
							id,
							type: 'next',
							payload: { data: { query: sparseLobbyStatistics(Date.now(), update) } },
						}),
					)
				active.set(id, send)
				send()
			} else if (packet.type === 'complete' && packet.id && ownIds.has(packet.id)) {
				ownIds.delete(packet.id)
				active.delete(packet.id)
			}
		})
	})
	await page.goto('/lobby/history?active=0')
	await expect(page.getByRole('heading', { name: 'Lobby History', exact: true })).toBeVisible()
	const countClocks = () =>
		page.evaluate(
			() =>
				Object.values(window.__lobbyPerformance.intervals).filter(
					(delay) => delay === 60_000,
				).length,
		)
	const baselineClocks = await countClocks()
	const countSeries = () => page.locator('.lobby-chart').first().locator('.v-charts-line')
	for (let visit = 0; visit < 3; visit++) {
		await page.getByRole('link', { name: 'Statistics', exact: true }).click()
		await expect.poll(() => active.size).toBe(1)
		const chart = page.locator('.lobby-chart').first()
		await expect(page.locator('.lobby-chart')).toHaveCount(3)
		const roomChart = page.locator('.lobby-chart').filter({
			has: page.getByRole('heading', { name: 'Room activity', exact: true }),
		})
		await expect(roomChart.getByRole('button')).toHaveCount(1)
		await expect(
			roomChart.getByRole('button', { name: 'Peak concurrent rooms', exact: true }),
		).toBeVisible()
		await expect(
			page.getByRole('heading', { name: /^(Daily|Monthly) (player|room) trends/ }),
		).toHaveCount(0)
		await expect(countSeries()).toHaveCount(2)
		await expect(chart.locator('.lobby-chart-gap')).toHaveCount(2)
		const gapPath = await chart.locator('.lobby-chart-gap').first().getAttribute('d')
		expect(gapPath?.match(/M/g)?.length).toBeGreaterThan(90)
		const ticks = await chart.locator('.v-charts-yAxis text').allTextContents()
		expect(
			Math.max(...ticks.map((value) => Number(value.replaceAll(',', '')))),
		).toBeGreaterThanOrEqual(1000)
		await expect.poll(countClocks).toBe(baselineClocks + 1)
		await page.evaluate(() => {
			window.__lobbyPerformance.maxLag = 0
		})
		for (let update = 1; update <= 3; update++) {
			const curve = chart.locator('path.v-charts-line-curve').first()
			const before = await curve.getAttribute('d')
			for (const send of active.values()) send(update * 10)
			await expect.poll(() => curve.getAttribute('d')).not.toBe(before)
		}
		// Target an actual sample; arbitrary coordinates can land on a missing-data row.
		const sample = await chart
			.locator('path.v-charts-line-curve')
			.first()
			.evaluate((element) => {
				const point = (element as SVGPathElement).getPointAtLength(0)
				return { x: point.x, y: point.y }
			})
		await chart.locator('svg').first().hover({ position: sample })
		await expect(chart.locator('.min-w-48')).toBeVisible()
		await page.getByLabel('Activity range', { exact: true }).selectOption('7d')
		await expect.poll(() => active.size).toBe(1)
		await expect(countSeries()).toHaveCount(2)
		const beforeIdle = await page.evaluate(() => ({ ...window.__lobbyPerformance }))
		await page.waitForTimeout(1500)
		const afterIdle = await page.evaluate(() => ({ ...window.__lobbyPerformance }))
		expect(afterIdle.date - beforeIdle.date).toBeLessThan(10)
		expect(afterIdle.number - beforeIdle.number).toBeLessThan(10)
		// Generous cross-browser CI budget, far below the original 18–33 second stalls.
		expect(afterIdle.maxLag).toBeLessThan(1500)
		await info.attach(`performance-${visit}`, {
			body: JSON.stringify(afterIdle),
			contentType: 'application/json',
		})
		await page.getByRole('link', { name: 'Lobby History', exact: true }).click()
		await page.getByRole('checkbox', { name: 'Include Active Rooms', exact: true }).uncheck()
		await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
		await expect(page).toHaveURL(/active=0/)
		await expect.poll(() => active.size).toBe(0)
		await expect(page.locator('.v-charts-line')).toHaveCount(0)
		await expect.poll(countClocks).toBe(baselineClocks)
	}
})
