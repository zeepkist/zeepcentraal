import { config } from '../config'

export interface SteamUserData {
	steamid: string
	personaname: string
}

export async function getSteamUser(steamId: string): Promise<SteamUserData> {
	if (!config.steam.apiKey) {
		throw new Error('Steam API key is not configured.')
	}

	const url =
		`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
		`?key=${config.steam.apiKey}&steamids=${steamId}`
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error('Steam user request failed.')
	}

	const data = (await response.json()) as { response?: { players?: SteamUserData[] } }
	const player = data.response?.players?.[0]
	if (!player) {
		throw new Error('Steam user not found.')
	}

	return player
}
