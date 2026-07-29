import type { GhostCapabilities, GhostFrame } from './types'

export function detectGhostCapabilities(
	frames: GhostFrame[],
	ghostVersion?: number,
): GhostCapabilities {
	const hasExtendedTelemetry = ghostVersion !== undefined && ghostVersion >= 6
	return {
		input: frames.some(
			(frame) =>
				typeof frame.steering === 'number' ||
				typeof frame.armsUp === 'boolean' ||
				typeof frame.braking === 'boolean' ||
				typeof frame.horn === 'boolean',
		),
		air: frames.some((frame) => typeof frame.groundedWheelState === 'number'),
		wheels: frames.some((frame) => typeof frame.groundedWheelState === 'number'),
		slipping:
			hasExtendedTelemetry ||
			frames.some((frame) => typeof frame.slippingWheelState === 'number'),
		state: frames.some(
			(frame) =>
				typeof frame.soap === 'boolean' ||
				typeof frame.offroad === 'boolean' ||
				typeof frame.paraglider === 'boolean' ||
				typeof frame.parkingBlock === 'boolean' ||
				typeof frame.monorail === 'boolean',
		),
		surfaces: frames.some(
			(frame) => typeof frame.surface === 'string' || Boolean(frame.surfaces?.length),
		),
		velocity: frames.some(
			(frame) =>
				frame.localVelocity !== undefined ||
				frame.localAngularVelocity !== undefined ||
				frame.localGForce !== undefined,
		),
		ragdoll: hasExtendedTelemetry || frames.some((frame) => typeof frame.ragdoll === 'boolean'),
		orientation: frames.some((frame) => frame.orientation !== undefined),
	}
}
