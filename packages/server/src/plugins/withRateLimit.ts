import { COOKIES, getCookie, verifyAccessToken } from '@zeepkist/core'
import { serverConfig } from '@zeepkist/core/config/server'
import type { Elysia } from 'elysia'
import { handleV1Error, V1_ERROR_CODES } from '../v1Errors'

type RateLimitBucket = 'auth' | 'record' | 'mutation' | 'job'

interface Counter {
	count: number
	resetSecond: number
}

const WINDOW_SECONDS = 60
const MAX_IDENTITIES = 10_000

function monotonicSecond() {
	return Math.floor(Bun.nanoseconds() / 1_000_000_000)
}

export class RateLimitStore implements Disposable {
	private readonly counters = new Map<string, Counter>()
	private readonly expiryBuckets = Array.from({ length: WINDOW_SECONDS }, () => new Set<string>())
	private currentSecond: number
	private readonly timer: ReturnType<typeof setInterval> | undefined

	public constructor(now = monotonicSecond(), schedule = true) {
		this.currentSecond = now
		this.timer = schedule
			? setInterval(() => this.advance(monotonicSecond()), 1_000)
			: undefined
		this.timer?.unref?.()
	}

	public get size(): number {
		return this.counters.size
	}

	public take(key: string, limit: number, now = monotonicSecond()) {
		this.advance(now)
		let counter = this.counters.get(key)
		if (!counter) {
			if (this.counters.size >= MAX_IDENTITIES) {
				return { allowed: false, retryAfter: 1 }
			}
			counter = { count: 0, resetSecond: now + WINDOW_SECONDS }
			this.counters.set(key, counter)
			this.expiryBuckets[counter.resetSecond % WINDOW_SECONDS]?.add(key)
		}
		counter.count++
		return {
			allowed: counter.count <= limit,
			retryAfter: Math.max(counter.resetSecond - now, 1),
		}
	}

	public [Symbol.dispose](): void {
		if (this.timer) clearInterval(this.timer)
		this.counters.clear()
		for (const bucket of this.expiryBuckets) bucket.clear()
	}

	private advance(now: number) {
		if (now <= this.currentSecond) return
		const start = Math.max(this.currentSecond + 1, now - WINDOW_SECONDS)
		for (let second = start; second <= now; second++) {
			const bucket = this.expiryBuckets[second % WINDOW_SECONDS]
			if (!bucket) continue
			for (const key of bucket) {
				const counter = this.counters.get(key)
				if (counter && counter.resetSecond <= second) this.counters.delete(key)
			}
			bucket.clear()
		}
		this.currentSecond = now
	}
}

const rateLimits = new RateLimitStore()

export function disposeRateLimiter(): void {
	rateLimits[Symbol.dispose]()
}

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
			const identity = authenticatedId(request) ?? clientIp(request, server)
			const key = `${bucket}:${identity}`
			const result = rateLimits.take(key, serverConfig.http.rateLimits[bucket])
			if (result.allowed) {
				return
			}

			set.status = 429
			set.headers['retry-after'] = String(result.retryAfter)
			return handleV1Error(V1_ERROR_CODES.GENERIC_INVALID_REQUEST)
		})
}
