import { describe, expect, it } from 'vitest'
import { lobbyGapPath } from '../../app/utils/lobbyChart'

describe('lobby gap paths', () => {
	it('connects only missing samples and keeps zero values', () => {
		expect(
			lobbyGapPath([
				{ x: 0, y: 8 },
				{ x: 1, y: null },
				{ x: 2, y: 0 },
				{ x: 3, y: 6 },
				{ x: 4, y: null },
				{ x: 5, y: 4 },
			]),
		).toBe('M0,8L2,0 M3,6L5,4')
	})
	it('never connects closure or reopening boundaries', () => {
		for (const boundary of [1, 2]) {
			const points = [
				{ x: 0, y: 8 },
				{ x: 1, y: null },
				{ x: 2, y: null },
				{ x: 3, y: 4 },
			]
			expect(
				lobbyGapPath(
					points.map((point, index) => ({
						...point,
						payload: { break: index === boundary ? 1 : null },
					})),
				),
			).toBe('')
		}
	})
	it('ignores leading, trailing and invalid coordinates', () => {
		expect(
			lobbyGapPath([
				{ x: 0, y: null },
				{ x: 1, y: 4 },
				{ x: 2, y: 5 },
				{ x: 3, y: null },
			]),
		).toBe('')
		expect(
			lobbyGapPath([
				{ x: 0, y: 4 },
				{ x: Number.NaN, y: 3 },
				{ x: 2, y: 5 },
			]),
		).toBe('M0,4L2,5')
	})
})
