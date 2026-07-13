const STEAM_ID_PATTERN = /^\d{17}$/
const ZEEPKIST_APP_ID = '1440670'

export function steamProfileUrl(steamId: unknown): string | undefined {
	const value = String(steamId ?? '').trim()
	return STEAM_ID_PATTERN.test(value) ? `https://steamcommunity.com/profiles/${value}` : undefined
}

export function steamWorkshopProfileUrl(steamId: unknown): string | undefined {
	const profile = steamProfileUrl(steamId)
	return profile ? `${profile}/myworkshopfiles/?appid=${ZEEPKIST_APP_ID}` : undefined
}
