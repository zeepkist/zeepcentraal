import { COOKIES, getCookie, verifyAccessToken } from '@zeepkist/core'
import { serverConfig } from '@zeepkist/core/config/server'
import type { Elysia } from 'elysia'
import { handleV1Error, V1_ERROR_CODES } from '../v1Errors'

type RateLimitBucket = 'auth' | 'record' | 'mutation' | 'job'

interface Counter {
	count: number
	resetAt: number
}

const WINDOW_MS = 60_000
const counters = new Map<string, Counter>()

function clientIp(
	request: Request,
	server: { requestIP(request: Request): { address: string } | null } | null,
): string {
	if (serverConfig.http.trustProxy) {
		const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
		if (forwarded) {
			return forwarded
		}
		const realIp = request.headers.get('x-real-ip')
		if (realIp) {
			return realIp
		}
	}
	return server?.requestIP(request)?.address ?? 'unknown'
}

function authenticatedId(request: Request): string | null {
	const authorization = request.headers.get('authorization')
	const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
	const token =
		bearer ?? getCookie(request.headers.get('cookie') ?? undefined, COOKIES.AccessToken)
	if (!token) {
		return null
	}
	try {
		return verifyAccessToken(token).steamId
	} catch {
		return null
	}
}

export function withRateLimit(bucket: RateLimitBucket) {
	return (app: Elysia) =>
		app.onBeforeHandle(({ request, server, set }) => {
			const now = Date.now()
			if (counters.size > 10_000) {
				for (const [key, counter] of counters) {
					if (counter.resetAt <= now) {
						counters.delete(key)
					}
				}
			}
			const identity = authenticatedId(request) ?? clientIp(request, server)
			const key = `${bucket}:${identity}`
			const current = counters.get(key)
			const counter =
				!current || current.resetAt <= now
					? { count: 0, resetAt: now + WINDOW_MS }
					: current
			counter.count++
			counters.set(key, counter)

			if (counter.count <= serverConfig.http.rateLimits[bucket]) {
				return
			}

			set.status = 429
			set.headers['retry-after'] = String(
				Math.max(Math.ceil((counter.resetAt - now) / 1000), 1),
			)
			return handleV1Error(V1_ERROR_CODES.GENERIC_INVALID_REQUEST)
		})
}
