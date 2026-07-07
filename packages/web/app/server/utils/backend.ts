import { authRefreshUrl, userUrl } from '../../utils/auth'

export function getBackendBaseUrl() {
	const config = useRuntimeConfig()
	return config.public.backendUrl
}

export function getForwardedCookieHeaders(event: Parameters<typeof getHeader>[0]) {
	const cookie = getHeader(event, 'cookie')
	return cookie ? { cookie } : undefined
}

export async function refreshWebAuth(event: Parameters<typeof getHeader>[0]) {
	await $fetch.raw(authRefreshUrl(getBackendBaseUrl()), {
		method: 'POST',
		headers: getForwardedCookieHeaders(event),
		credentials: 'include',
	})
}

export async function fetchBackendUser(event: Parameters<typeof getHeader>[0]) {
	return await $fetch(userUrl(getBackendBaseUrl()), {
		headers: getForwardedCookieHeaders(event),
		credentials: 'include',
	})
}
