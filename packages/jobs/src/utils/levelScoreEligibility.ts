export interface LevelWorkshopAvailability {
	accessibleItemCount: number
	adventure: boolean
	itemCount: number
}

export function isLevelScoreEligible(availability: LevelWorkshopAvailability): boolean {
	return (
		availability.adventure ||
		availability.itemCount === 0 ||
		availability.accessibleItemCount > 0
	)
}
