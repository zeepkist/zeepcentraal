export const STEAM_VISIBILITY = {
	Public: 0,
	FriendsOnly: 1,
	Hidden: 2,
	Unlisted: 3,
} as const

export type SteamVisibility = (typeof STEAM_VISIBILITY)[keyof typeof STEAM_VISIBILITY]

export const STEAM_ACCESSIBLE_VISIBILITIES = [
	STEAM_VISIBILITY.Public,
	STEAM_VISIBILITY.Unlisted,
] as const

export type AccessibleSteamVisibility = (typeof STEAM_ACCESSIBLE_VISIBILITIES)[number]

export function isSteamWorkshopItemAccessible(
	visibility: number,
): visibility is AccessibleSteamVisibility {
	return STEAM_ACCESSIBLE_VISIBILITIES.some(
		(accessibleVisibility) => accessibleVisibility === visibility,
	)
}

export function canSteamCmdDownloadWorkshopItem(visibility: number): boolean {
	return isSteamWorkshopItemAccessible(visibility)
}
