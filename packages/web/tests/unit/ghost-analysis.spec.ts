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

	it('splits airborne controls using exact grounded wheel bits', () => {
		const frames: GhostPlaybackFrame[] = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 1,
				braking: true,
				armsUp: true,
			},
			{
				time: 0.1,
				position: { x: 1, y: 1, z: 0 },
				groundedWheelState: 0,
				braking: true,
				armsUp: true,
				steering: -0.11,
			},
			{
				time: 0.2,
				position: { x: 2, y: 1, z: 0 },
				groundedWheelState: 16,
				steering: 0.11,
			},
		]
		const events = buildGhostTimelineEvents(frames, 0)

		expect(events.filter(({ kind }) => kind === 'braking')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'arms-up')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'air-braking')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'air-arms-up')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'air-steering-left')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'air-steering-right')).toHaveLength(1)
		expect(events.filter(({ kind }) => kind === 'airborne')).toHaveLength(1)
	})

	it('does not infer airborne controls without wheel-contact evidence', () => {
		const frames: GhostPlaybackFrame[] = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				inAir: true,
				braking: true,
				armsUp: true,
				steering: 1,
			},
		]
		const kinds = buildGhostTimelineEvents(frames).map(({ kind }) => kind)

		expect(kinds).toContain('braking')
		expect(kinds).toContain('arms-up')
		expect(kinds).not.toContain('airborne')
		expect(kinds).not.toContain('air-braking')
		expect(kinds).not.toContain('air-arms-up')
		expect(kinds).not.toContain('air-steering-right')
	})

	it('uses strict steering deadzone boundaries for airborne rotation', () => {
		const frames: GhostPlaybackFrame[] = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 0,
				steering: -0.1,
			},
			{
				time: 0.1,
				position: { x: 1, y: 0, z: 0 },
				groundedWheelState: 0,
				steering: 0.1,
			},
		]
		const kinds = buildGhostTimelineEvents(frames).map(({ kind }) => kind)

		expect(kinds).not.toContain('air-steering-left')
		expect(kinds).not.toContain('air-steering-right')
	})
})
