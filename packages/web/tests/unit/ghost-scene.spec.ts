import { describe, expect, it } from 'vitest'
import type { GhostPlaybackFrame } from '../../app/types/ghost'
import {
	buildGhostGrid,
	interpolateGhostFrame,
	rebaseGhostPosition,
} from '../../app/utils/ghostScene'

describe('ghost scene', () => {
	it('builds exact 16 metre cells and 64 metre major lines', () => {
		const grid = buildGhostGrid([
			[
				{ time: 0, position: { x: -17, y: 3, z: 1 } },
				{ time: 1, position: { x: 75, y: 3, z: 145 } },
			],
		])
		const allX = [...grid.minorX, ...grid.majorX].toSorted((a, b) => a - b)
		expect(allX.slice(1).every((value, index) => value - (allX[index] ?? value) === 16)).toBe(
			true,
		)
		expect(grid.majorX.every((value) => value % 64 === 0)).toBe(true)
		expect(grid.maximumX - grid.minimumX).toBeGreaterThanOrEqual(256)
	})

	it('snaps large and negative coordinates without losing grid alignment', () => {
		const grid = buildGhostGrid([
			[{ time: 0, position: { x: -1_000_003, y: 100, z: 2_000_009 } }],
		])
		expect(Math.abs(grid.origin.x % 16)).toBe(0)
		expect(Math.abs(grid.origin.y % 16)).toBe(0)
		expect(Math.abs(grid.origin.z % 16)).toBe(0)
		const rebased = rebaseGhostPosition({ x: -1_000_003, y: 100, z: 2_000_009 }, grid.origin)
		expect(Number.isFinite(rebased.x)).toBe(true)
		expect(Number.isFinite(rebased.z)).toBe(true)
	})

	it('interpolates positions, speed, and steering by playback time', () => {
		const frames: GhostPlaybackFrame[] = [
			{ time: 0, position: { x: 0, y: 0, z: 0 }, speed: 10, steering: -1 },
			{ time: 2, position: { x: 20, y: 4, z: 10 }, speed: 30, steering: 1 },
		]
		expect(interpolateGhostFrame(frames, 1)).toMatchObject({
			position: { x: 10, y: 2, z: 5 },
			speed: 20,
			steering: 0,
		})
	})
})
