import { Elysia, StatusMap } from 'elysia'

export type RequestLogLevel = 'ERROR' | 'WARNING' | 'INFO'
export type RequestLogSpeed = 'FAST' | 'SLOW' | 'VERY_SLOW'

export interface RequestLogEntry {
	durationMs: number
	ip: string
	level: RequestLogLevel
	method: string
	pathname: string
	speed: RequestLogSpeed
	status: number
	timestamp: Date
}

export interface ElysiaRequestLoggingOptions {
	enabled?: boolean
	sink?: (entry: RequestLogEntry) => void
	slowThresholdMs?: number
	trustProxy?: boolean
	verySlowThresholdMs?: number
}

function resolveStatus(status: number | keyof typeof StatusMap | undefined) {
	if (typeof status === 'number') return status
	if (status !== undefined) return StatusMap[status]
	return 200
}

function resolveIp(
	request: Request,
	server: { requestIP(request: Request): { address: string } | null } | null,
	trustProxy: boolean,
) {
	if (trustProxy) {
		const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
		if (forwarded) return forwarded
	}

	return server?.requestIP(request)?.address ?? '-'
}

function defaultSink(entry: RequestLogEntry) {
	const line = formatRequestLog(entry)
	if (entry.level === 'ERROR') console.error(line)
	else if (entry.level === 'WARNING') console.warn(line)
	else console.info(line)
}

export function formatRequestLog(entry: RequestLogEntry) {
	const timestamp = entry.timestamp.toISOString().replace('T', ' ').replace('Z', '')
	return `${timestamp} ${entry.level}\t${entry.method}\t${entry.status} ${entry.pathname} ${entry.durationMs.toFixed(2)}ms ${entry.speed} ${entry.ip}`
}

export function createElysiaRequestLoggingPlugin(options: ElysiaRequestLoggingOptions = {}) {
	const plugin = new Elysia({ name: '@zeepkist/telemetry/request-logging' })
	if (options.enabled === false) return plugin

	const starts = new WeakMap<Request, number>()
	const slowThresholdMs = options.slowThresholdMs ?? 500
	const verySlowThresholdMs = options.verySlowThresholdMs ?? 1_000
	const sink = options.sink ?? defaultSink

	return plugin
		.request(({ request }) => {
			starts.set(request, performance.now())
		})
		.afterResponse(({ request, server, set }) => {
			const durationMs = Math.max(
				0,
				performance.now() - (starts.get(request) ?? performance.now()),
			)
			starts.delete(request)
			const status = resolveStatus(set.status)
			const level: RequestLogLevel =
				status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : 'INFO'
			const speed: RequestLogSpeed =
				durationMs >= verySlowThresholdMs
					? 'VERY_SLOW'
					: durationMs >= slowThresholdMs
						? 'SLOW'
						: 'FAST'

			sink({
				timestamp: new Date(),
				level,
				method: request.method,
				status,
				pathname: new URL(request.url).pathname,
				durationMs,
				speed,
				ip: resolveIp(request, server, options.trustProxy ?? false),
			})
		})
		.as('global')
}
