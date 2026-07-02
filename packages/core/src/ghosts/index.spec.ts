import { describe, expect, test } from 'bun:test'
import { calculateGhostStatistics, SurfaceState, validateGhostStatisticPayload } from './index'
import { parseDecodedV6 } from './v6'

describe('ghost statistic validation', () => {
	test('maps known surface distance and time to typed fields', () => {
		const stats = validateGhostStatisticPayload({
			frameCount: 2,
			timeInAir: 1,
			timeOnGround: 2,
			maxSpeed: 500,
			surfaceDistance: { sand: 10 },
			surfaceTime: { sand: 2 },
		})

		expect(stats.frameCount).toBe(2)
		expect(stats.timeInAir).toBe(1)
		expect(stats.timeOnGround).toBe(2)
		expect(stats.maxSpeed).toBe(500)
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

describe('V6 ghost frame parsing', () => {
	test('maps V6 state ProtoMembers and unscales compressed vectors', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 1, y: 2, z: 3 },
				speed: 10,
				steering: 128,
				inputFlags: 1,
				soapboxFlags: 0,
				groundedWheelState: 3,
				slippingWheelState: 1,
				surfaceState: SurfaceState.Sand | SurfaceState.Ice,
				localVelocity: { x: 100_000, y: 0, z: 0 },
				localAngularVelocity: { x: 0, y: 200, z: 0 },
				localGForce: { x: 100_000, y: 0 },
				parkingBlockState: true,
				monorailState: true,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					rotation: { x: 100, y: 200, z: 300 },
					speed: 20,
					steering: 255,
					inputFlags: 0,
					soapboxFlags: 0,
					groundedWheelState: 0,
					slippingWheelState: 0,
					surfaceState: SurfaceState.Tarmac,
					localVelocity: { x: 200_000, y: 0, z: 0 },
					localAngularVelocity: { x: 0, y: 300, z: 0 },
					localGForce: { x: 200_000, y: 0 },
					parkingBlockState: false,
					monorailState: false,
				},
			],
		})

		expect(ghost.frames).toHaveLength(2)
		expect(ghost.frames[0]?.localVelocity).toEqual({ x: 1, y: 0, z: 0 })
		expect(ghost.frames[0]?.localAngularVelocity).toEqual({ x: 0, y: 2, z: 0 })
		expect(ghost.frames[0]?.localGForce).toEqual({ x: 1, y: 0 })
		expect(ghost.frames[0]?.surfaces).toEqual(['sand', 'ice'])
		expect(ghost.frames[0]?.parkingBlock).toBe(true)
		expect(ghost.frames[0]?.monorail).toBe(true)
		expect(ghost.frames[1]?.position).toEqual({ x: 1, y: 0, z: 0 })
		expect(ghost.frames[1]?.rotation).toEqual({ x: 1, y: 2, z: 3 })
	})
})

describe('ghost statistics calculation', () => {
	test('splits V6 mixed surface distance and records state distances', () => {
		const stats = calculateGhostStatistics([
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 3,
				slippingWheelState: 1,
				surfaces: ['sand', 'ice'],
				inAir: false,
				parkingBlock: true,
				monorail: true,
				localVelocity: { x: 1, y: 0, z: 0 },
				localAngularVelocity: { x: 0, y: 2, z: 0 },
				localGForce: { x: 1, y: 0 },
			},
			{
				time: 1,
				position: { x: 10, y: 0, z: 0 },
				groundedWheelState: 0,
				slippingWheelState: 0,
				surfaces: ['tarmac'],
				inAir: true,
				parkingBlock: false,
				monorail: false,
				localVelocity: { x: 2, y: 0, z: 0 },
				localAngularVelocity: { x: 0, y: 3, z: 0 },
				localGForce: { x: 2, y: 0 },
			},
		])

		expect(stats.distance).toBe(10)
		expect(stats.distanceOn2Wheels).toBe(10)
		expect(stats.timeOn2Wheels).toBe(1)
		expect(stats.distanceOnSand).toBe(5)
		expect(stats.distanceOnIce).toBe(5)
		expect(stats.timeOnSand).toBe(0.5)
		expect(stats.timeOnIce).toBe(0.5)
		expect(stats.distanceSlipping).toBe(10)
		expect(stats.distanceOnMonorail).toBe(10)
		expect(stats.distanceParked).toBe(10)
		expect(stats.averageVelocity).toBe(1)
		expect(stats.maxVelocity).toBe(2)
		expect(stats.averageAngularVelocity).toBe(2)
		expect(stats.maxAngularVelocity).toBe(3)
		expect(stats.averageGforce).toBe(1)
		expect(stats.maxGforce).toBe(2)
	})
})
