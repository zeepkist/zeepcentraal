export interface LevelWorkshopAvailability {
	adventure: boolean
	itemCount: number
	accessibleItemCount: number
}

export function isLevelScoreEligible(availability: LevelWorkshopAvailability): boolean {
	return (
		availability.adventure ||
		availability.itemCount === 0 ||
		availability.accessibleItemCount > 0
	)
}
