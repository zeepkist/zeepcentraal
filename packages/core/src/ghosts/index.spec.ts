import { describe, expect, test } from 'bun:test'
import { V6SurfaceState } from './enums'
import {
	calculateGhostStatistics,
	detectGhostCapabilities,
	MaterialPhysicsState,
	SoapboxFlags,
} from './index'
import { type DecodedProtobufGhost, iterateProtobufFrames } from './protobuf'
import { calculateGhostStatisticsFromIterable } from './statistics'
import { parseDecodedV5 } from './v5'
import { parseDecodedV6 } from './v6'
import { parseDecodedV7 } from './v7'

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
				surfaceState: V6SurfaceState.Sand | V6SurfaceState.Ice,
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
					surfaceState: V6SurfaceState.Tarmac,
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
		expect(ghost.frames[0]?.surfaces).toEqual(['sand', 'ice1'])
		expect(ghost.frames[0]?.parkingBlock).toBe(true)
		expect(ghost.frames[0]?.monorail).toBe(true)
		expect(ghost.frames[1]?.position).toEqual({ x: 1, y: 0, z: 0 })
		expect(ghost.frames[1]?.rotation).toEqual({ x: 1, y: 2, z: 3 })
	})

	test('normalizes V6 particle-only states to physical categories', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				surfaceState:
					V6SurfaceState.Metal |
					V6SurfaceState.Snow |
					V6SurfaceState.Flesh |
					V6SurfaceState.Ice,
			},
			deltaFrames: [],
		})

		expect(ghost.frames[0]?.surfaces).toEqual(['tarmac', 'sand', 'ice1', 'mud'])
	})

	test('reconstructs one-way V6 ragdoll frames', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				ragdollState: false,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					ragdollState: true,
					ragdollPosition: { x: 300_000, y: 0, z: 0 },
					ragdollRotation: { x: 100, y: 200, z: 300 },
				},
				{
					time: 2,
					position: { x: 100_000, y: 0, z: 0 },
					ragdollState: true,
					ragdollPosition: { x: 100_000, y: 0, z: 0 },
					ragdollRotation: { x: 100, y: 0, z: 0 },
				},
			],
		})

		expect(ghost.frames[0]?.ragdoll).toBe(false)
		expect(ghost.frames[1]?.ragdollPosition).toEqual({ x: 3, y: 0, z: 0 })
		expect(ghost.frames[1]?.ragdollRotation).toEqual({ x: 1, y: 2, z: 3 })
		expect(ghost.frames[2]?.ragdollPosition).toEqual({ x: 4, y: 0, z: 0 })
		expect(ghost.frames[2]?.ragdollRotation).toEqual({ x: 2, y: 2, z: 3 })
	})

	test('rejects V6 ragdoll true to false transition', () => {
		expect(() =>
			parseDecodedV6({
				version: 6,
				initialFrame: {
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					ragdollState: true,
					ragdollPosition: { x: 0, y: 0, z: 0 },
					ragdollRotation: { x: 0, y: 0, z: 0 },
				},
				deltaFrames: [
					{
						time: 1,
						position: { x: 100_000, y: 0, z: 0 },
						ragdollState: false,
					},
				],
			}),
		).toThrow('Invalid protobuf ghost ragdoll state')
	})

	test('rejects active V6 ragdoll frame without transform data', () => {
		expect(() =>
			parseDecodedV6({
				version: 6,
				initialFrame: {
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					ragdollState: false,
				},
				deltaFrames: [
					{
						time: 1,
						position: { x: 100_000, y: 0, z: 0 },
						ragdollState: true,
					},
				],
			}),
		).toThrow('Invalid protobuf ghost ragdoll frame')
	})
})

describe('V7 ghost frame parsing', () => {
	test('maps all material physics flags and leaves None unattributed', () => {
		const allMaterialPhysics =
			MaterialPhysicsState.Tarmac |
			MaterialPhysicsState.Grass |
			MaterialPhysicsState.Sand |
			MaterialPhysicsState.Soap |
			MaterialPhysicsState.Wood |
			MaterialPhysicsState.Mud |
			MaterialPhysicsState.Ice1 |
			MaterialPhysicsState.Ice2 |
			MaterialPhysicsState.Ice3
		const ghost = parseDecodedV7({
			version: 7,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				surfaceState: allMaterialPhysics,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					surfaceState: MaterialPhysicsState.None,
				},
			],
		})

		expect(ghost.frames[0]?.surfaces).toEqual([
			'tarmac',
			'grass',
			'sand',
			'soap',
			'wood',
			'mud',
			'ice1',
			'ice2',
			'ice3',
		])
		expect(ghost.frames[1]?.surfaces).toEqual([])
		expect(ghost.version).toBe(7)
	})
})

describe('protobuf ghost statistic capabilities', () => {
	test('streaming V5 statistics match full reconstructed frame statistics', () => {
		const decoded: DecodedProtobufGhost = {
			version: 5,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				speed: 100,
				steering: 128,
				inputFlags: 0,
				soapboxFlags: SoapboxFlags.Soap | SoapboxFlags.FrontLeft,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					speed: 120,
					steering: 255,
					inputFlags: 1,
					soapboxFlags: SoapboxFlags.Paraglider,
				},
			],
		}
		const full = parseDecodedV5(decoded)

		expect(calculateGhostStatisticsFromIterable(iterateProtobufFrames(decoded), 5)).toEqual(
			calculateGhostStatistics(full.frames, full.version),
		)
	})

	test('streaming V6 statistics match full reconstructed frame statistics', () => {
		const decoded: DecodedProtobufGhost = {
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0 },
				speed: 100,
				steering: 128,
				inputFlags: 0,
				soapboxFlags: SoapboxFlags.FrontLeft | SoapboxFlags.RearLeft,
				groundedWheelState: 15,
				slippingWheelState: 1,
				surfaceState: V6SurfaceState.Grass,
				localVelocity: { x: 100_000, y: 0, z: 0 },
				ragdollState: false,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					speed: 120,
					steering: 255,
					inputFlags: 1,
					soapboxFlags: SoapboxFlags.Paraglider,
					groundedWheelState: 0,
					slippingWheelState: 0,
					surfaceState: V6SurfaceState.Tarmac,
					localVelocity: { x: 200_000, y: 0, z: 0 },
					ragdollState: true,
					ragdollPosition: { x: 100_000, y: 0, z: 0 },
					ragdollRotation: { x: 0, y: 0, z: 0 },
				},
				{
					time: 2,
					position: { x: 100_000, y: 0, z: 0 },
					groundedWheelState: 15,
					ragdollState: true,
					ragdollPosition: { x: 100_000, y: 0, z: 0 },
					ragdollRotation: { x: 0, y: 0, z: 0 },
				},
			],
		}
		const full = parseDecodedV6(decoded)

		expect(calculateGhostStatisticsFromIterable(iterateProtobufFrames(decoded), 6)).toEqual(
			calculateGhostStatistics(full.frames, full.version),
		)
	})

	test('retains V5 inputs and wheel existence without fabricating V6 telemetry', () => {
		const ghost = parseDecodedV5({
			version: 5,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				speed: 120,
				steering: 128,
				inputFlags: 0,
				soapboxFlags:
					SoapboxFlags.Soap |
					SoapboxFlags.FrontLeft |
					SoapboxFlags.FrontRight |
					SoapboxFlags.RearLeft |
					SoapboxFlags.RearRight,
				groundedWheelState: 15,
				slippingWheelState: 0,
				surfaceState: V6SurfaceState.Tarmac,
				localVelocity: { x: 100_000, y: 0, z: 0 },
				parkingBlockState: true,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					steering: 255,
					inputFlags: 1,
					soapboxFlags: SoapboxFlags.FrontLeft | SoapboxFlags.RearLeft,
					groundedWheelState: 15,
					slippingWheelState: 0,
					surfaceState: V6SurfaceState.Tarmac,
					localVelocity: { x: 100_000, y: 0, z: 0 },
					parkingBlockState: true,
				},
			],
		})
		expect(ghost.frames[0]).toMatchObject({
			speed: 120,
			armsUp: false,
			braking: false,
			horn: false,
			soap: true,
			wheelState: 15,
		})
		expect(ghost.frames[0]?.inAir).toBeUndefined()
		expect(ghost.frames[0]?.groundedWheelState).toBeUndefined()
		expect(ghost.frames[0]?.slippingWheelState).toBeUndefined()
		expect(ghost.frames[0]?.surfaces).toBeUndefined()
		expect(ghost.frames[0]?.localVelocity).toBeUndefined()
		expect(ghost.frames[0]?.parkingBlock).toBeUndefined()
		const stats = calculateGhostStatistics(ghost.frames, ghost.version)

		expect(stats).toMatchObject({
			ghostVersion: 5,
			hasInputData: true,
			hasAirData: false,
			hasWheelData: false,
			hasSlipData: false,
			hasStateData: true,
			hasSurfaceData: false,
			hasVelocityData: false,
			hasRagdollData: false,
		})
	})

	test('uses only V6 grounded-wheel bitsets to identify airborne frames', () => {
		for (const groundedWheelState of [0, 1, 2, 4, 8, 15]) {
			const ghost = parseDecodedV6({
				version: 6,
				initialFrame: {
					position: { x: 0, y: 0, z: 0 },
					groundedWheelState,
				},
				deltaFrames: [],
			})

			expect(ghost.frames[0]?.inAir).toBe(groundedWheelState === 0)
			expect(ghost.frames[0]?.groundedWheelState).toBe(groundedWheelState)
		}
	})

	test('preserves omitted V6 zero-valued grounded-wheel state', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 15,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
				},
				{
					time: 2,
					position: { x: 100_000, y: 0, z: 0 },
					groundedWheelState: 15,
				},
			],
		})
		const stats = calculateGhostStatistics(ghost.frames, ghost.version)

		expect(ghost.frames[1]?.groundedWheelState).toBe(0)
		expect(ghost.frames[1]?.inAir).toBe(true)
		expect(stats.distanceInAir).toBe(1)
		expect(stats.distanceOnGround).toBe(1)
		expect(stats.timeInAir).toBe(1)
		expect(stats.timeOnGround).toBe(1)
	})

	test('keeps omitted zero-state V6 slip and inactive ragdoll telemetry available', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 15,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					groundedWheelState: 15,
				},
			],
		})
		const stats = calculateGhostStatistics(ghost.frames, ghost.version)

		expect(ghost.capabilities.slipping).toBe(true)
		expect(ghost.capabilities.ragdoll).toBe(true)
		expect(stats.hasSlipData).toBe(true)
		expect(stats.hasRagdollData).toBe(true)
		expect(stats.distanceSlipping).toBe(0)
		expect(stats.timeSlipping).toBe(0)
		expect(stats.distanceRagdoll).toBe(0)
		expect(stats.timeRagdoll).toBe(0)
	})

	test('maps observed V6 velocity and ragdoll fields to statistic capabilities', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				localVelocity: { x: 100_000, y: 0, z: 0 },
				ragdollState: false,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 100_000, y: 0, z: 0 },
					localVelocity: { x: 100_000, y: 0, z: 0 },
					ragdollState: false,
				},
			],
		})
		const stats = calculateGhostStatistics(ghost.frames, ghost.version)

		expect(stats.ghostVersion).toBe(6)
		expect(stats.hasVelocityData).toBe(true)
		expect(stats.hasRagdollData).toBe(true)
	})
})

describe('ghost statistics calculation', () => {
	test('uses grounded-wheel state for air statistics and capabilities', () => {
		const frames = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 15,
				inAir: true,
			},
			{
				time: 1,
				position: { x: 10, y: 0, z: 0 },
				groundedWheelState: 0,
				inAir: false,
			},
			{
				time: 2,
				position: { x: 20, y: 0, z: 0 },
				groundedWheelState: 0,
				inAir: false,
			},
			{
				time: 3,
				position: { x: 30, y: 0, z: 0 },
				groundedWheelState: 15,
				inAir: true,
			},
		]
		const stats = calculateGhostStatistics(frames)

		expect(detectGhostCapabilities(frames).air).toBe(true)
		expect(stats.hasAirData).toBe(true)
		expect(stats.distanceInAir).toBe(20)
		expect(stats.distanceOnGround).toBe(10)
		expect(stats.timeInAir).toBe(2)
		expect(stats.timeOnGround).toBe(1)
	})

	test('does not infer air capability from legacy inAir values', () => {
		const frames = [
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				inAir: true,
			},
			{
				time: 1,
				position: { x: 1, y: 0, z: 0 },
				inAir: false,
			},
		]
		const stats = calculateGhostStatistics(frames)

		expect(detectGhostCapabilities(frames).air).toBe(false)
		expect(stats.hasAirData).toBe(false)
		expect(stats.distanceInAir).toBeNull()
		expect(stats.distanceOnGround).toBeNull()
		expect(stats.timeInAir).toBeNull()
		expect(stats.timeOnGround).toBeNull()
	})

	test('maps unknown legacy frame surface to tarmac', () => {
		const stats = calculateGhostStatistics([
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				surface: 'lava',
			},
			{
				time: 1,
				position: { x: 10, y: 0, z: 0 },
				surface: 'lava',
			},
		])

		expect(stats.distanceOnTarmac).toBe(10)
		expect(stats.timeOnTarmac).toBe(1)
	})

	test('splits V6 mixed surface distance and records state distances', () => {
		const stats = calculateGhostStatistics([
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				groundedWheelState: 3,
				slippingWheelState: 1,
				surfaces: ['sand', 'ice1'],
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
		expect(stats.distanceOnIce1).toBe(5)
		expect(stats.timeOnSand).toBe(0.5)
		expect(stats.timeOnIce1).toBe(0.5)
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

	test('normalizes V6 particle states into physical statistics', () => {
		const ghost = parseDecodedV6({
			version: 6,
			initialFrame: {
				position: { x: 0, y: 0, z: 0 },
				surfaceState: V6SurfaceState.Wood | V6SurfaceState.Mud | V6SurfaceState.Flesh,
			},
			deltaFrames: [
				{
					time: 1,
					position: { x: 300_000, y: 0, z: 0 },
					surfaceState: V6SurfaceState.Tarmac,
				},
			],
		})
		const stats = calculateGhostStatistics(ghost.frames, ghost.version)

		expect(ghost.frames[0]?.surfaces).toEqual(['tarmac', 'mud'])
		expect(stats.distanceOnTarmac).toBe(1.5)
		expect(stats.distanceOnMud).toBe(1.5)
		expect(stats.distanceOnWood).toBe(0)
		expect(stats.timeOnTarmac).toBeCloseTo(0.5)
		expect(stats.timeOnMud).toBeCloseTo(0.5)
	})

	test('calculates ragdoll distance and time from ragdoll positions', () => {
		const stats = calculateGhostStatistics([
			{
				time: 0,
				position: { x: 0, y: 0, z: 0 },
				ragdoll: false,
			},
			{
				time: 1,
				position: { x: 10, y: 0, z: 0 },
				ragdoll: true,
				ragdollPosition: { x: 20, y: 0, z: 0 },
			},
			{
				time: 2,
				position: { x: 20, y: 0, z: 0 },
				ragdoll: true,
				ragdollPosition: { x: 25, y: 0, z: 0 },
			},
		])

		expect(stats.distanceRagdoll).toBe(5)
		expect(stats.timeRagdoll).toBe(1)
	})

	test('reports observed capabilities and driver input union metrics', () => {
		const stats = calculateGhostStatistics(
			[
				{
					time: 0,
					position: { x: 0, y: 0, z: 0 },
					steering: -0.5,
					armsUp: true,
					braking: false,
					inAir: false,
					groundedWheelState: 15,
					slippingWheelState: 0,
					soap: false,
					offroad: false,
					paraglider: false,
					surfaces: ['tarmac'],
					localVelocity: { x: 1, y: 0, z: 0 },
					ragdoll: false,
				},
				{
					time: 1,
					position: { x: 1, y: 0, z: 0 },
					steering: 0,
					armsUp: false,
					braking: true,
					inAir: false,
					groundedWheelState: 15,
					slippingWheelState: 0,
					soap: false,
					offroad: false,
					paraglider: false,
					surfaces: ['tarmac'],
					localVelocity: { x: 1, y: 0, z: 0 },
					ragdoll: false,
				},
				{
					time: 2,
					position: { x: 2, y: 0, z: 0 },
					steering: 0,
					armsUp: false,
					braking: false,
					inAir: false,
					groundedWheelState: 15,
					slippingWheelState: 0,
					soap: false,
					offroad: false,
					paraglider: false,
					surfaces: ['tarmac'],
					localVelocity: { x: 1, y: 0, z: 0 },
					ragdoll: false,
				},
			],
			6,
		)

		expect(stats).toMatchObject({
			ghostVersion: 6,
			hasInputData: true,
			hasAirData: true,
			hasWheelData: true,
			hasSlipData: true,
			hasStateData: true,
			hasSurfaceData: true,
			hasVelocityData: true,
			hasRagdollData: true,
			timeAnyDriverInput: 2,
			driverInputTransitionCount: 3,
		})
	})

	test('keeps unsupported capability metrics null', () => {
		const stats = calculateGhostStatistics(
			[
				{ time: 0, position: { x: 0, y: 0, z: 0 } },
				{ time: 1, position: { x: 1, y: 0, z: 0 } },
			],
			1,
		)

		expect(stats.ghostVersion).toBe(1)
		expect(stats.hasInputData).toBe(false)
		expect(stats.hasAirData).toBe(false)
		expect(stats.timeAnyDriverInput).toBeNull()
		expect(stats.driverInputTransitionCount).toBeNull()
	})
})
