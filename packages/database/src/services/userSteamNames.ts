interface SteamUserData {
	steamid: string
	personaname: string
}

export interface ExistingSteamUser {
	steamId: string
	steamName: string | null
}

export type FetchSteamUser = (steamId: string) => Promise<SteamUserData | undefined>

export async function resolveBulkSteamNames(
	steamIds: string[],
	existingUsers: ExistingSteamUser[],
	fetchSteamUser: FetchSteamUser,
): Promise<Map<string, string>> {
	const existingBySteamId = new Map(existingUsers.map((entry) => [entry.steamId, entry]))
	const resolved = new Map<string, string>()

	await Promise.all(
		steamIds.map(async (steamId) => {
			const existing = existingBySteamId.get(steamId)
			if (existing?.steamName && existing.steamName !== 'Unknown') {
				resolved.set(steamId, existing.steamName)
				return
			}

			try {
				resolved.set(steamId, (await fetchSteamUser(steamId))?.personaname ?? 'Unknown')
			} catch {
				resolved.set(steamId, 'Unknown')
			}
		}),
	)

	return resolved
}
