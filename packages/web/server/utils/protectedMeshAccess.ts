import { cookieHeaderFromSetCookies, refreshWebAuth } from './backend'
import { resolveVerifiedSession } from './session'

const MAXIMUM_RATE_WINDOW_ENTRIES = 50_000

type RateWindow = { count: number; resetAt: number }

const rateWindows = new Map<string, RateWindow>()

export async function requireProtectedMeshAccess(event: Parameters<typeof getHeader>[0]) {
	const { getRefreshableWebSession, getWebSession } = await import('@zeepkist/database/services')
	const cookieHeader = getHeader(event, 'cookie')
	const resolution = await resolveVerifiedSession(
		cookieHeader,
		getWebSession,
		getRefreshableWebSession,
		async () => {
			const refreshed = await refreshWebAuth(event)
			return cookieHeaderFromSetCookies(refreshed.cookies)
		},
	)
	if (!resolution.session) {
		throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
	}
	const steamId = String(resolution.session.steamId)
	assertRateLimit(`account-minute:${steamId}`, 30, 60_000)
	assertRateLimit(`account-day:${steamId}`, 300, 24 * 60 * 60 * 1_000)
	assertRateLimit(`ip-minute:${requestIp(event)}`, 60, 60_000)
	return resolution.session
}

export function consumeRateLimit(key: string, limit: number, duration: number, now = Date.now()) {
	const current = rateWindows.get(key)
	if (!current || current.resetAt <= now) {
		pruneExpiredEntries(rateWindows, now, MAXIMUM_RATE_WINDOW_ENTRIES)
		rateWindows.set(key, { count: 1, resetAt: now + duration })
		return { allowed: true, retryAfter: 0 }
	}
	if (current.count >= limit) {
		return {
			allowed: false,
			retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
		}
	}
	current.count += 1
	return { allowed: true, retryAfter: 0 }
}

function pruneExpiredEntries<T extends { expiresAt?: number; resetAt?: number }>(
	entries: Map<string, T>,
	now: number,
	maximumEntries: number,
) {
	for (const [key, value] of entries) {
		const expiry = value.expiresAt ?? value.resetAt ?? 0
		if (expiry <= now || entries.size >= maximumEntries) entries.delete(key)
		if (entries.size < maximumEntries) break
	}
}

function assertRateLimit(key: string, limit: number, duration: number) {
	const result = consumeRateLimit(key, limit, duration)
	if (result.allowed) return
	throw createError({
		statusCode: 429,
		statusMessage: 'Protected asset rate limit exceeded',
		data: { retryAfter: result.retryAfter },
	})
}

function requestIp(event: Parameters<typeof getHeader>[0]) {
	return (
		getHeader(event, 'cf-connecting-ip') ??
		getHeader(event, 'x-forwarded-for')?.split(',', 1)[0]?.trim() ??
		'unknown'
	)
}

export function clearProtectedMeshAccessCaches() {
	rateWindows.clear()
}
