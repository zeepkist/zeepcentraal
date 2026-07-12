interface ExistingWorkshopLevelItem {
	deleted: boolean
	id: number
	idLevel: number
	xxHash: string
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
