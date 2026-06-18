export const COOKIES = {
	AccessToken: 'zeepcentral_access_token',
	RefreshToken: 'zeepcentral_refresh_token',
	SteamId: 'zeepcentral_steam_id',
	OAuthState: 'zeepcentral_oauth_state',
} as const

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
	const cookies: Record<string, string> = {}
	for (const item of (cookieHeader ?? '').split(';')) {
		const [key, ...rest] = item.trim().split('=')
		if (!key) {
			continue
		}
		try {
			cookies[key] = decodeURIComponent(rest.join('='))
		} catch {
			// Ignore malformed cookie values.
		}
	}
	return cookies
}

export function getCookie(cookieHeader: string | undefined, name: string): string | null {
	return parseCookieHeader(cookieHeader)[name] ?? null
}
