import { readSessionCookies, type SessionCookies } from './backend'

export type SessionResolutionReason =
	| 'database_error'
	| 'incomplete_cookies'
	| 'invalid_tuple'
	| 'refresh_failed'
	| 'refreshed'
	| 'refreshed_tuple_invalid'
	| 'verified'

export type SessionResolution<T> = {
	session: T | null
	reason: SessionResolutionReason
}

export async function resolveVerifiedSession<T>(
	cookieHeader: string | null | undefined,
	lookup: (cookies: SessionCookies) => Promise<T | null>,
	canRefresh: (cookies: Pick<SessionCookies, 'steamId' | 'refreshToken'>) => Promise<boolean>,
	refresh: () => Promise<string>,
): Promise<SessionResolution<T>> {
	const cookies = readSessionCookies(cookieHeader)
	if (!cookies) return { session: null, reason: 'incomplete_cookies' }

	let session: T | null
	try {
		session = await lookup(cookies)
	} catch {
		return { session: null, reason: 'database_error' }
	}
	if (session) return { session, reason: 'verified' }

	try {
		if (
			!(await canRefresh({
				steamId: cookies.steamId,
				refreshToken: cookies.refreshToken,
			}))
		) {
			return { session: null, reason: 'invalid_tuple' }
		}
	} catch {
		return { session: null, reason: 'database_error' }
	}

	let refreshedCookies: SessionCookies | null
	try {
		refreshedCookies = readSessionCookies(await refresh())
	} catch {
		return { session: null, reason: 'refresh_failed' }
	}
	if (!refreshedCookies) return { session: null, reason: 'refresh_failed' }

	try {
		const refreshedSession = await lookup(refreshedCookies)
		return refreshedSession
			? { session: refreshedSession, reason: 'refreshed' }
			: { session: null, reason: 'refreshed_tuple_invalid' }
	} catch {
		return { session: null, reason: 'database_error' }
	}
}
