import { describe, expect, test } from 'bun:test'
import { validateGhostStatisticPayload } from './index'

describe('ghost statistic validation', () => {
	test('maps known surface distance and time to typed fields', () => {
		const stats = validateGhostStatisticPayload({
			frameCount: 2,
			timeInAir: 1,
			timeOnGround: 2,
			topSpeed: 500,
			surfaceDistance: { sand: 10 },
			surfaceTime: { sand: 2 },
		})

		expect(stats.frameCount).toBe(2)
		expect(stats.timeInAir).toBe(1)
		expect(stats.timeOnGround).toBe(2)
		expect(stats.topSpeed).toBe(500)
		expect(stats.distanceOnSand).toBe(10)
		expect(stats.timeOnSand).toBe(2)
	})

	test('maps unknown surfaces to tarmac', () => {
		const stats = validateGhostStatisticPayload({
			surfaceDistance: { lava: 3 },
			surfaceTime: { lava: 4 },
		})

		expect(stats.distanceOnTarmac).toBe(3)
		expect(stats.timeOnTarmac).toBe(4)
	})
})
