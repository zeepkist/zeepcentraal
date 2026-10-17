import { describe, expect, it } from 'bun:test'
import { calculateGhostStatistics } from './statistics'
import type { GhostFrame } from './types'

const frames: GhostFrame[] = Array.from({ length: 5 }, (_, index) => ({
	time: index,
	position: { x: index * 10, y: 0, z: 0 },
	groundedWheelState: index === 2 ? 0 : 15,
	surfaces: index === 1 ? ['wood', 'mud'] : [],
}))

describe('Unknown surface statistics', () => {
	for (const version of [7, 8]) {
		it(`classifies grounded V${version} gaps without changing known surfaces`, () => {
			const statistics = calculateGhostStatistics(frames, version)
			expect(statistics.distanceOnUnknown).toBe(20)
			expect(statistics.timeOnUnknown).toBe(2)
			expect(statistics.distanceOnWood).toBe(5)
			expect(statistics.distanceOnMud).toBe(5)
			expect(statistics.timeOnWood).toBe(0.5)
			expect(statistics.distanceOnGround).toBe(30)
		})
		it(`rejects invalid V${version} distance but preserves elapsed time`, () => {
			const statistics = calculateGhostStatistics(
				[
					{ time: 0, position: { x: 0, y: 0, z: 0 }, groundedWheelState: 15 },
					{ time: 1, position: { x: 1000, y: 0, z: 0 }, groundedWheelState: 15 },
				],
				version,
			)
			expect(statistics.distanceOnUnknown).toBe(0)
			expect(statistics.timeOnUnknown).toBe(1)
		})
		it(`keeps airborne V${version} intervals empty`, () => {
			const statistics = calculateGhostStatistics(
				frames.map((frame) => ({ ...frame, groundedWheelState: 0, surfaces: [] })),
				version,
			)
			expect(statistics.distanceOnUnknown).toBe(0)
			expect(statistics.timeOnUnknown).toBe(0)
		})
	}
	it('keeps unsupported, missing, and empty telemetry null', () => {
		for (const version of [5, 6])
			expect(calculateGhostStatistics(frames, version).distanceOnUnknown).toBeNull()
		expect(
			calculateGhostStatistics([{ time: 0, position: { x: 0, y: 0, z: 0 } }], 8)
				.timeOnUnknown,
		).toBeNull()
		expect(calculateGhostStatistics([], 8).distanceOnUnknown).toBeNull()
	})
})
