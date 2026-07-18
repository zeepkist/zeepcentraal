import { describe, expect, it } from 'vitest'
import type { GhostPlaybackFrame } from '../../app/types/ghost'
import { buildGhostSlipEvents, buildGhostTimelineEvents } from '../../app/utils/ghostAnalysis'

describe('ghost analysis', () => {
	it('merges short gaps between matching events', () => {
		const frames: GhostPlaybackFrame[] = [
			{ time: 0, position: { x: 0, y: 0, z: 0 }, braking: true },
			{ time: 0.05, position: { x: 1, y: 0, z: 0 }, braking: false },
			{ time: 0.1, position: { x: 2, y: 0, z: 0 }, braking: true },
			{ time: 0.3, position: { x: 3, y: 0, z: 0 }, braking: false },
		]
		const braking = buildGhostTimelineEvents(frames).filter(({ kind }) => kind === 'braking')
		expect(braking).toHaveLength(1)
		expect(braking[0]).toMatchObject({ start: 0, end: 0.1 })
	})

	it('calculates meaningful slip events and rejects tiny noise', () => {
		const frames: GhostPlaybackFrame[] = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				slippingWheelState: 1,
				speed: 100,
				steering: 0.5,
			},
			{
				time: 0.2,
				position: { x: 5, y: 0, z: 0 },
				slippingWheelState: 1,
				speed: 90,
				steering: 0.75,
			},
			{
				time: 0.3,
				position: { x: 6, y: 0, z: 0 },
				slippingWheelState: 0,
				speed: 88,
				steering: 0,
			},
		]
		const events = buildGhostSlipEvents(frames)
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({
			duration: 0.2,
			distance: 5,
			entrySpeed: 100,
			exitSpeed: 90,
			wheelState: 1,
			peakSteering: 0.75,
		})
	})
})
