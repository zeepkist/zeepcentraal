import { webAuthCookieNames } from '../../shared/authCookies'

export { webAuthCookieNames } from '../../shared/authCookies'

export function webAuthCookieDomain(hostname: string) {
	return hostname === 'zeepki.st' || hostname.endsWith('.zeepki.st') ? '.zeepki.st' : undefined
}

export function clearWebAuthCookies(event: Parameters<typeof getHeader>[0]) {
	const url = getRequestURL(event)
	const options = {
		path: '/',
		domain: webAuthCookieDomain(url.hostname),
		secure: url.protocol === 'https:',
		sameSite: 'lax' as const,
	}
	for (const name of webAuthCookieNames) deleteCookie(event, name, options)
	deleteCookie(event, 'zeepcentral_oauth_state', { ...options, path: '/auth/' })
}
