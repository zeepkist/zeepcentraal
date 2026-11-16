import type { TelemetryHttpServerSpanInput } from './span'

const MOD_HEADERS = new Map([
	['x-gtr-version', 'mod.version'],
	['x-zeepkist-version', 'mod.zeepkistVersion'],
	['x-zeepkist-major-version', 'mod.zeepkistMajorVersion'],
	['x-steam-id', 'mod.steamId'],
])

export function getModTraceAttributes(headers: TelemetryHttpServerSpanInput['headers']) {
	const attributes: Record<string, string> = {}
	const entries = headers instanceof Headers ? headers.entries() : Object.entries(headers)
	for (const [name, value] of entries) {
		const attribute = MOD_HEADERS.get(name.toLowerCase())
		if (
			attribute &&
			typeof value === 'string' &&
			value.trim() &&
			/^[\x20-\x7e]+$/.test(value)
		) {
			attributes[attribute] = value
		}
	}
	return attributes
}
