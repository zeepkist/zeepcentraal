export const webAuthCookieNames = [
	'zeepcentral_access_token',
	'zeepcentral_refresh_token',
	'zeepcentral_steam_id',
] as const

export function hasCompleteWebAuthCookieTuple(cookieHeader?: string | null): boolean {
	const present = new Set<string>()
	for (const item of (cookieHeader ?? '').split(';')) {
		const separator = item.indexOf('=')
		if (separator < 1 || item.slice(separator + 1).trim().length === 0) continue
		present.add(item.slice(0, separator).trim())
	}

	return webAuthCookieNames.every((name) => present.has(name))
}
