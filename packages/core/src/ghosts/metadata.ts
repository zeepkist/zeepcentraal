import type { GhostCosmetics, GhostMetadata } from './types'

const GHOST_COLOR_PATTERN = /^#[0-9a-f]{8}$/i

export function emptyGhostMetadata(): GhostMetadata {
	return {
		steamId: null,
		taggedUsername: null,
		color: null,
		cosmetics: null,
	}
}

export function legacyGhostMetadata(
	steamId: bigint,
	zeepkist: number,
	hat: number,
	color: number,
): GhostMetadata {
	return {
		steamId: steamId.toString(),
		taggedUsername: null,
		color: null,
		cosmetics: {
			zeepkist,
			frontWheels: null,
			rearWheels: null,
			paraglider: null,
			horn: null,
			hat,
			glasses: null,
			colorBody: null,
			colorLeftArm: null,
			colorRightArm: null,
			colorLeftLeg: null,
			colorRightLeg: null,
			color,
		},
	}
}

export function normalizeGhostColor(value: unknown): string | null {
	if (typeof value !== 'string' || !GHOST_COLOR_PATTERN.test(value)) return null
	return value.toUpperCase()
}

export function optionalCosmeticId(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

export function hasAnyCosmetic(cosmetics: GhostCosmetics): boolean {
	return Object.values(cosmetics).some((value) => value !== null)
}
