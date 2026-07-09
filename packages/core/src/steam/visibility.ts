export const STEAM_VISIBILITY = {
	Public: 0,
	FriendsOnly: 1,
	Hidden: 2,
	Unlisted: 3,
} as const

export type SteamVisibility = (typeof STEAM_VISIBILITY)[keyof typeof STEAM_VISIBILITY]

export function canSteamCmdDownloadWorkshopItem(visibility: number): boolean {
	return visibility === STEAM_VISIBILITY.Public || visibility === STEAM_VISIBILITY.Unlisted
}
