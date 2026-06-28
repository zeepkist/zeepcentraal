export const presentBlockId = 2264

export function parseFinite(value: string, label: string): number {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid ${label}: ${value}`)
	}
	return parsed
}

export function numberOrDefault(value: unknown, fallback = 0): number {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : fallback
	}
	if (typeof value === 'string') {
		const parsed = Number(value)
		return Number.isFinite(parsed) ? parsed : fallback
	}
	return fallback
}

export function integerOrDefault(value: unknown, fallback = 0): number {
	return Math.trunc(numberOrDefault(value, fallback))
}

export function medalTime(value: unknown): number {
	return numberOrDefault(value)
}

export function compareNumber(left: number, right: number): number {
	return left < right ? -1 : left > right ? 1 : 0
}
