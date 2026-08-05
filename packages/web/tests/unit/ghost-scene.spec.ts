import { describe, expect, it } from 'vitest'
import type { GhostPlaybackFrame } from '../../app/types/ghost'
import {
	buildGhostGrid,
	calculateGhostLabelWorldOffset,
	calculateIsometricCameraDepth,
	interpolateGhostFrame,
	orthographicWorldUnitsPerPixel,
	perspectiveWorldUnitsPerPixel,
	planGhostVisualReconciliation,
	rebaseGhostPosition,
	resolveGhostDisplayPosition,
	resolveGhostFrameTiming,
	resolveGhostPlaybackStartTime,
	resolveGhostRendererOptions,
	resolveGhostSelectedRecordId,
	resolveGhostTrailSampleLimit,
	resolveGhostTrailSimplificationTolerance,
	sampleGhostTrailFrames,
	simplifyGhostTrailFrames,
} from '../../app/utils/ghostScene'

describe('ghost scene', () => {
	it('selects WebGL power and antialiasing options by quality', () => {
		expect(resolveGhostRendererOptions('performance')).toEqual({
			antialias: false,
			powerPreference: 'low-power',
			stencil: false,
		})
		expect(resolveGhostRendererOptions('balanced')).toEqual({
			antialias: true,
			powerPreference: 'low-power',
			stencil: false,
		})
		expect(resolveGhostRendererOptions('quality')).toEqual({
			antialias: true,
			powerPreference: 'high-performance',
			stencil: false,
		})
	})

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

	it('keeps real route height and expands isometric camera depth for steep trails', () => {
		const flat = buildGhostGrid([
			[
				{ time: 0, position: { x: 0, y: 0, z: 0 } },
				{ time: 1, position: { x: 0, y: 10, z: 0 } },
			],
		])
		const steep = buildGhostGrid([
			[
				{ time: 0, position: { x: 0, y: -300, z: 0 } },
				{ time: 1, position: { x: 0, y: 300, z: 0 } },
			],
		])

		expect(steep.routeMaximum.y - steep.routeMinimum.y).toBe(600)
		expect(calculateIsometricCameraDepth(steep).distance).toBeGreaterThan(
			calculateIsometricCameraDepth(flat).distance,
		)
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

	it('interpolates active ragdoll positions for smooth playback', () => {
		const frames: GhostPlaybackFrame[] = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				ragdoll: true,
				ragdollPosition: { x: 10, y: 2, z: 4 },
			},
			{
				time: 2,
				position: { x: 0, y: 0, z: 0 },
				ragdoll: true,
				ragdollPosition: { x: 20, y: 6, z: 8 },
			},
		]

		expect(interpolateGhostFrame(frames, 1)?.ragdollPosition).toEqual({ x: 15, y: 4, z: 6 })
	})

	it('uses reported ragdoll position only while ragdoll is active', () => {
		const position = { x: 1, y: 2, z: 3 }
		const ragdollPosition = { x: 8, y: 9, z: 10 }

		expect(resolveGhostDisplayPosition({ time: 0, position, ragdollPosition })).toBe(position)
		expect(
			resolveGhostDisplayPosition({ time: 0, position, ragdoll: true, ragdollPosition }),
		).toBe(ragdollPosition)
	})

	it('restarts playback from zero at the completed timeline', () => {
		expect(resolveGhostPlaybackStartTime(30, 30)).toBe(0)
		expect(resolveGhostPlaybackStartTime(29.9998, 30)).toBe(0)
		expect(resolveGhostPlaybackStartTime(12, 30)).toBe(12)
	})

	it('keeps pending primary selected while slower ghosts load first', () => {
		expect(resolveGhostSelectedRecordId(1, 1, [2, 3], false)).toBe(1)
	})

	it('falls back after primary failure and preserves manual loaded selection', () => {
		expect(resolveGhostSelectedRecordId(1, 1, [2, 3], true)).toBe(2)
		expect(resolveGhostSelectedRecordId(3, 1, [1, 2, 3], false)).toBe(3)
		expect(resolveGhostSelectedRecordId(null, null, [2, 3], false)).toBe(2)
	})

	it('increases label world clearance as perspective camera moves away', () => {
		const close = calculateGhostLabelWorldOffset(
			perspectiveWorldUnitsPerPixel(20, 48, 720),
			24,
			0,
		)
		const distant = calculateGhostLabelWorldOffset(
			perspectiveWorldUnitsPerPixel(500, 48, 720),
			24,
			0,
		)

		expect(close).toBe(4.5)
		expect(distant).toBeGreaterThan(close)
	})

	it('increases label clearance when orthographic camera zooms out', () => {
		const close = calculateGhostLabelWorldOffset(
			orthographicWorldUnitsPerPixel(80, 2, 720),
			24,
			0,
		)
		const distant = calculateGhostLabelWorldOffset(
			orthographicWorldUnitsPerPixel(800, 1, 720),
			24,
			0,
		)

		expect(distant).toBeGreaterThan(close)
	})

	it('staggered labels keep increasing world-up clearance', () => {
		const first = calculateGhostLabelWorldOffset(0.5, 24, 0)
		const fourth = calculateGhostLabelWorldOffset(0.5, 24, 3)

		expect(fourth).toBeGreaterThan(first)
	})

	it('allocates quality-dependent bulk trail budgets without exceeding per-ghost caps', () => {
		expect(resolveGhostTrailSampleLimit('performance', 200, true)).toBe(125)
		expect(resolveGhostTrailSampleLimit('balanced', 200, true)).toBe(300)
		expect(resolveGhostTrailSampleLimit('quality', 200, true)).toBe(600)
		expect(resolveGhostTrailSampleLimit('performance', 3, true)).toBe(2_000)
		expect(resolveGhostTrailSampleLimit('balanced', 1_000, true)).toBe(60)
	})

	it('halves per-ghost trail caps outside bulk playback', () => {
		expect(resolveGhostTrailSampleLimit('performance', 200, false)).toBe(2_000)
		expect(resolveGhostTrailSampleLimit('balanced', 200, false)).toBe(6_000)
		expect(resolveGhostTrailSampleLimit('quality', 200, false)).toBe(15_000)
	})

	it('preserves trail endpoints while uniformly sampling frames', () => {
		const frames = Array.from({ length: 1_001 }, (_, index) => index)
		const sampled = sampleGhostTrailFrames(frames, 128)

		expect(sampled).toHaveLength(128)
		expect(sampled[0]).toBe(0)
		expect(sampled.at(-1)).toBe(1_000)
		expect(sampleGhostTrailFrames(frames, 2)).toEqual([0, 1_000])
	})

	it('preserves frame cadence remainder on high-refresh displays', () => {
		for (const refreshRate of [60, 120, 144]) {
			for (const target of [30, 60] as const) {
				let phase: number | null = null
				let rendered = 0
				const callbackCount = refreshRate * 10
				for (let index = 0; index <= callbackCount; index += 1) {
					const timing = resolveGhostFrameTiming(
						phase,
						(index * 1_000) / refreshRate,
						target,
					)
					phase = timing.framePhase
					if (timing.frameDue) rendered += 1
				}
				expect(rendered).toBeGreaterThanOrEqual(target * 10)
				expect(rendered).toBeLessThanOrEqual(target * 10 + 1)
			}
		}
	})

	it('resets frame cadence when no previous phase exists', () => {
		expect(resolveGhostFrameTiming(null, 500, 60)).toEqual({
			frameDue: true,
			framePhase: 500,
		})
		expect(resolveGhostFrameTiming(500, 508, 60).frameDue).toBe(false)
	})

	it('uses quality-dependent world-space trail simplification', () => {
		expect(resolveGhostTrailSimplificationTolerance('performance')).toBe(0.25)
		expect(resolveGhostTrailSimplificationTolerance('balanced')).toBe(0.1)
		expect(resolveGhostTrailSimplificationTolerance('quality')).toBe(0.04)
	})

	it('simplifies straight trails while retaining corners and endpoints', () => {
		const frames: GhostPlaybackFrame[] = [
			{ time: 0, position: { x: 0, y: 0, z: 0 } },
			{ time: 0.01, position: { x: 5, y: 0, z: 0 } },
			{ time: 0.02, position: { x: 10, y: 0, z: 0 } },
			{ time: 0.03, position: { x: 10, y: 0, z: 10 } },
			{ time: 0.04, position: { x: 10, y: 0, z: 20 } },
		]
		const simplified = simplifyGhostTrailFrames(frames, 'balanced', 100)

		expect(simplified.map(({ time }) => time)).toEqual([0, 0.02, 0.04])
		expect(simplified[0]).toBe(frames[0])
		expect(simplified.at(-1)).toBe(frames.at(-1))
	})

	it('deterministically raises tolerance until the hard trail cap is met', () => {
		const frames: GhostPlaybackFrame[] = Array.from({ length: 1_000 }, (_, index) => ({
			time: index,
			position: { x: index, y: index % 2 === 0 ? 0 : 10, z: 0 },
		}))
		const first = simplifyGhostTrailFrames(frames, 'quality', 32)
		const second = simplifyGhostTrailFrames(frames, 'quality', 32)

		expect(first.length).toBeLessThanOrEqual(32)
		expect(first.map(({ time }) => time)).toEqual(second.map(({ time }) => time))
		expect(first[0]?.time).toBe(0)
		expect(first.at(-1)?.time).toBe(999)
		expect(
			first.every(
				(frame, index) => index === 0 || frame.time > (first[index - 1]?.time ?? -1),
			),
		).toBe(true)
	})

	it('retains temporal anchors so straight trails reveal during playback', () => {
		const frames: GhostPlaybackFrame[] = Array.from({ length: 101 }, (_, index) => ({
			time: index / 10,
			position: { x: index, y: 0, z: 0 },
		}))
		const simplified = simplifyGhostTrailFrames(frames, 'performance', 100)

		expect(simplified.map(({ time }) => time)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	})

	it('reconciles keyed ghost visuals and recreates only changed revisions or identities', () => {
		expect(
			planGhostVisualReconciliation(
				[
					{ recordId: 1, revision: 'one' },
					{ recordId: 2, revision: 'two' },
					{ recordId: 3, revision: 'three' },
				],
				[
					{ recordId: 1, revision: 'one' },
					{ recordId: 2, revision: 'two-updated' },
					{ recordId: 4, revision: 'four' },
				],
			),
		).toEqual({
			create: [
				{ recordId: 2, revision: 'two-updated' },
				{ recordId: 4, revision: 'four' },
			],
			remove: [3, 2],
			retain: [1],
		})
	})
})
