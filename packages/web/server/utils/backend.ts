import { authRefreshUrl, userUrl } from '../../app/utils/auth'

export function getBackendBaseUrl() {
	const config = useRuntimeConfig()
	return config.public.backendUrl
}

export function getForwardedCookieHeaders(event: Parameters<typeof getHeader>[0]) {
	const cookie = getHeader(event, 'cookie')
	return cookie ? { cookie } : undefined
}

export function accessTokenRefreshAt(cookieHeader?: string | null) {
	const token = cookieHeader
		?.split(';')
		.map((item) => item.trim())
		.find((item) => item.startsWith('zeepcentral_access_token='))
		?.slice('zeepcentral_access_token='.length)
	const payload = token?.split('.')[1]
	if (!payload) return null
	try {
		const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }
		return parsed.exp ? parsed.exp * 1000 - 60_000 : null
	} catch {
		return null
	}
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
	return { refreshAt: accessTokenRefreshAt(cookies.join(';')) }
}

export async function fetchBackendUser(event: Parameters<typeof getHeader>[0]) {
	return await $fetch(userUrl(getBackendBaseUrl()), {
		headers: getForwardedCookieHeaders(event),
		credentials: 'include',
	})
}
