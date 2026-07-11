import { authRefreshUrl } from '../../app/utils/auth'

export type SessionCookies = {
	steamId: string
	accessToken: string
	refreshToken: string
}

export function getBackendBaseUrl() {
	const config = useRuntimeConfig()
	return config.public.backendUrl
}

export function getForwardedCookieHeaders(event: Parameters<typeof getHeader>[0]) {
	const cookie = getHeader(event, 'cookie')
	return cookie ? { cookie } : undefined
}

export function accessTokenExpiresAt(cookieHeader?: string | null) {
	const token = cookieHeader
		?.split(';')
		.map((item) => item.trim())
		.find((item) => item.startsWith('zeepcentral_access_token='))
		?.slice('zeepcentral_access_token='.length)
	const payload = token?.split('.')[1]
	if (!payload) return null
	try {
		const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }
		return parsed.exp ? parsed.exp * 1000 : null
	} catch {
		return null
	}
}

export function accessTokenRefreshAt(cookieHeader?: string | null) {
	const expiresAt = accessTokenExpiresAt(cookieHeader)
	return expiresAt === null ? null : expiresAt - 60_000
}

export function cookieHeaderFromSetCookies(cookies: string[]) {
	return cookies
		.map((cookie) => cookie.split(';', 1)[0])
		.filter(Boolean)
		.join('; ')
}

export function readSessionCookies(cookieHeader?: string | null): SessionCookies | null {
	const cookies: Record<string, string> = {}
	for (const item of (cookieHeader ?? '').split(';')) {
		const [key, ...rest] = item.trim().split('=')
		if (!key) continue
		try {
			cookies[key] = decodeURIComponent(rest.join('='))
		} catch {
			return null
		}
	}
	const steamId = cookies.zeepcentral_steam_id
	const accessToken = cookies.zeepcentral_access_token
	const refreshToken = cookies.zeepcentral_refresh_token
	return steamId && accessToken && refreshToken ? { steamId, accessToken, refreshToken } : null
}

export function forwardBackendCookies(event: Parameters<typeof getHeader>[0], headers: Headers) {
	const setCookies =
		(headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
		(headers.get('set-cookie') ? [headers.get('set-cookie') as string] : [])
	for (const cookie of setCookies) appendResponseHeader(event, 'set-cookie', cookie)
	return setCookies
}

export async function refreshWebAuth(event: Parameters<typeof getHeader>[0]) {
	const response = await $fetch.raw(authRefreshUrl(getBackendBaseUrl()), {
		method: 'POST',
		headers: getForwardedCookieHeaders(event),
		credentials: 'include',
	})
	const cookies = forwardBackendCookies(event, response.headers)
	return { cookies, refreshAt: accessTokenRefreshAt(cookieHeaderFromSetCookies(cookies)) }
}
