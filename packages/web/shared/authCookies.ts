export const webAuthCookieNames = [
	'zeepcentral_access_token',
	'zeepcentral_refresh_token',
	'zeepcentral_steam_id',
] as const

function presentCookieNames(cookieHeader?: string | null) {
	const present = new Set<string>()
	for (const item of (cookieHeader ?? '').split(';')) {
		const separator = item.indexOf('=')
		if (separator < 1 || item.slice(separator + 1).trim().length === 0) continue
		present.add(item.slice(0, separator).trim())
	}
	return present
}

export function hasCompleteWebAuthCookieTuple(cookieHeader?: string | null): boolean {
	const present = presentCookieNames(cookieHeader)
	return webAuthCookieNames.every((name) => present.has(name))
}

export function hasRefreshableWebAuthCookieTuple(cookieHeader?: string | null): boolean {
	const present = presentCookieNames(cookieHeader)
	const [, refreshTokenName, steamIdName] = webAuthCookieNames
	return present.has(refreshTokenName) && present.has(steamIdName)
}
