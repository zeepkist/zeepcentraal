export function backendRoute(baseUrl: string, path: string) {
	return new URL(path, baseUrl).href
}

export function steamRedirectUrl(baseUrl: string) {
	return backendRoute(baseUrl, '/auth/steam/redirect')
}

export function discordRedirectUrl(baseUrl: string) {
	return backendRoute(baseUrl, '/auth/discord/redirect')
}

export function authRefreshUrl(baseUrl: string) {
	return backendRoute(baseUrl, '/auth/web/refresh')
}

export function userUrl(baseUrl: string) {
	return backendRoute(baseUrl, '/user')
}
