import { webAuthCookieNames } from '#shared/authCookies'
import { authRefreshUrl } from '../../app/utils/auth'

export type RefreshableSessionCookies = {
	steamId: string
	refreshToken: string
}

export type SessionCookies = RefreshableSessionCookies & {
	accessToken: string
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
	const accessTokenCookieName = webAuthCookieNames[0]
	const prefix = `${accessTokenCookieName}=`
	const token = cookieHeader
		?.split(';')
		.map((item) => item.trim())
		.find((item) => item.startsWith(prefix))
		?.slice(prefix.length)
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

function readCookieHeader(cookieHeader?: string | null) {
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
	return cookies
}

export function readRefreshableSessionCookies(
	cookieHeader?: string | null,
): RefreshableSessionCookies | null {
	const cookies = readCookieHeader(cookieHeader)
	if (!cookies) return null
	const [, refreshTokenName, steamIdName] = webAuthCookieNames
	const steamId = cookies[steamIdName]
	const refreshToken = cookies[refreshTokenName]
	return steamId && refreshToken ? { steamId, refreshToken } : null
}

export function readSessionCookies(cookieHeader?: string | null): SessionCookies | null {
	const cookies = readCookieHeader(cookieHeader)
	if (!cookies) return null
	const [accessTokenName, refreshTokenName, steamIdName] = webAuthCookieNames
	const steamId = cookies[steamIdName]
	const accessToken = cookies[accessTokenName]
	const refreshToken = cookies[refreshTokenName]
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

export async function fetchAuthenticatedBackend<T>(
	event: Parameters<typeof getHeader>[0],
	path: string,
	options: { method: 'POST' | 'DELETE'; body?: Record<string, unknown> },
) {
	let cookie = getHeader(event, 'cookie')
	let response = await $fetch.raw<T>(new URL(path, getBackendBaseUrl()).toString(), {
		...options,
		headers: cookie ? { cookie } : undefined,
		credentials: 'include',
		ignoreResponseError: true,
	})
	if (response.status === 401 && readRefreshableSessionCookies(cookie)) {
		const refreshed = await refreshWebAuth(event)
		cookie = cookieHeaderFromSetCookies(refreshed.cookies)
		response = await $fetch.raw<T>(new URL(path, getBackendBaseUrl()).toString(), {
			...options,
			headers: cookie ? { cookie } : undefined,
			credentials: 'include',
			ignoreResponseError: true,
		})
	}
	forwardBackendCookies(event, response.headers)
	if (response.status >= 400) {
		throw createError({
			statusCode: response.status,
			statusMessage: 'Authenticated backend request failed',
			data: response._data,
		})
	}
	return response._data as T
}
