import { isSteamWorkshopItemAccessible } from '@zeepkist/core/steam'

interface ExistingWorkshopLevelItem {
	deleted: boolean
	id: number
	idLevel: number
	xxHash: string
}

export function hasWorkshopAccessibilityChanged(
	previousVisibility: number,
	nextVisibility: number,
): boolean {
	return (
		isSteamWorkshopItemAccessible(previousVisibility) !==
		isSteamWorkshopItemAccessible(nextVisibility)
	)
}

export function resolveWorkshopMetadataBlocks({
	existingBlocks,
	inputBlocks,
	visibility,
}: {
	existingBlocks: unknown
	inputBlocks: unknown
	visibility: number
}): unknown {
	if (isSteamWorkshopItemAccessible(visibility)) {
		return inputBlocks
	}
	return Array.isArray(existingBlocks) && existingBlocks.length > 0 ? existingBlocks : []
}

interface ExistingLevel {
	id: number
}

export function resolveWorkshopLevelId({
	inputXxHash,
	existingItem,
	existingByXxHash,
	existingByLegacyHash,
	createdLevel,
}: {
	inputXxHash: string
	existingItem?: ExistingWorkshopLevelItem
	existingByXxHash?: ExistingLevel
	existingByLegacyHash?: ExistingLevel
	createdLevel?: ExistingLevel
}): number | undefined {
	if (existingByXxHash) {
		return existingByXxHash.id
	}
	if (existingItem?.xxHash === inputXxHash) {
		return existingItem.idLevel
	}
	return existingByLegacyHash?.id ?? createdLevel?.id
}

/** Workshop discovery state must never remove built-in Adventure level aliases. */
export function shouldDeleteWorkshopLevelItem({ adventure }: { adventure: boolean }): boolean {
	return !adventure
}
