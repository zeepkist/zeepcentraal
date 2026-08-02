import type { GhostPlaybackFrame } from '~/types/ghost'

export const GHOST_SOAPBOX_SCALE = 0.5
export const GHOST_SOAPBOX_GROUND_LIFT_WHEEL_FACTOR = 0.75

export const GHOST_WHEEL_COLORS = {
	standard: 0x171513,
	offroad: 0xb86b2b,
	soap: 0xec4899,
} as const

export const GHOST_SOAPBOX_AXLE_POSITIONS = [
	[0.0025708675, -1.0019066334, 1.999999702],
	[0.0003154278, -1.0285066664, -1.9494156837],
] as const

export const GHOST_SOAPBOX_WHEEL_LAYOUT = [
	{
		position: [-1.2661195993, -1.1215953827, 2.0044670105],
		mirror: true,
	},
	{
		position: [1.2583709955, -1.1208541095, 2.0044670105],
		mirror: false,
	},
	{
		position: [-1.2962406874, -1.1450186074, -1.9389901161],
		mirror: true,
	},
	{
		position: [1.303114295, -1.1383075714, -1.9389901161],
		mirror: false,
	},
] as const

export function resolveGhostWheelColor(
	frame: Pick<GhostPlaybackFrame, 'soap' | 'offroad'>,
): number {
	if (frame.soap) return GHOST_WHEEL_COLORS.soap
	if (frame.offroad) return GHOST_WHEEL_COLORS.offroad
	return GHOST_WHEEL_COLORS.standard
}

export function isGhostWheelPresent(wheelState: number | undefined, wheelIndex: number): boolean {
	if (wheelState === undefined) return true
	return (wheelState & (1 << wheelIndex)) !== 0
}
