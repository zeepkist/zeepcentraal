import {
	calculateDecayMultiplier,
	calculatePlayerPointsDecayed,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import type { RecordHistoryRow } from '~/types/app'

export type RecordRankLookup = {
	levelId: number
	time: number
}

type RecordRankFetcher = (lookup: RecordRankLookup) => Promise<unknown>

type RecordRankResolverOptions = {
	maxConcurrency?: number
	onResolved?: (key: string, rank: number | null) => void
}

export function recordRankLookupKey(
	record: Pick<RecordHistoryRow, 'levelId' | 'levelPosition' | 'pbOrWr' | 'time'>,
) {
	if (
		!record.pbOrWr ||
		record.levelPosition != null ||
		!Number.isSafeInteger(record.levelId) ||
		record.levelId < 1 ||
		!Number.isFinite(record.time) ||
		record.time <= 0
	) {
		return null
	}

	return `${record.levelId}:${record.time}`
}

export function personalBestRankFromFasterCount(value: unknown) {
	const fasterCount = typeof value === 'number' ? value : Number.NaN
	if (!Number.isSafeInteger(fasterCount) || fasterCount < 0) return null
	return fasterCount + 1
}

export function enrichRecordWithPersonalBestRank(record: RecordHistoryRow, rank: number) {
	if (!Number.isSafeInteger(rank) || rank < 1 || record.levelPosition != null) return record

	const levelDecayMultiplier = calculateDecayMultiplier(rank, LEVEL_DECAY_FACTOR)
	const levelDecayedPoints =
		record.levelPoints == null
			? record.levelDecayedPoints
			: calculatePlayerPointsDecayed(record.levelPoints, rank, LEVEL_DECAY_FACTOR)

	return {
		...record,
		levelPosition: rank,
		levelDecayMultiplier: record.levelDecayMultiplier ?? levelDecayMultiplier,
		levelDecayedPoints: record.levelDecayedPoints ?? levelDecayedPoints,
	}
}

function createConcurrencyLimiter(maxConcurrency: number) {
	const pending: Array<() => void> = []
	let active = 0

	function drain() {
		while (active < maxConcurrency) {
			const start = pending.shift()
			if (!start) return
			active += 1
			start()
		}
	}

	return function limit<T>(task: () => Promise<T>) {
		return new Promise<T>((resolve, reject) => {
			pending.push(() => {
				task()
					.then(resolve, reject)
					.finally(() => {
						active -= 1
						drain()
					})
			})
			drain()
		})
	}
}

export function createRecordRankResolver(
	fetchFasterCount: RecordRankFetcher,
	options: RecordRankResolverOptions = {},
) {
	const resolved = new Map<string, number | null>()
	const inFlight = new Map<string, Promise<number | null>>()
	const limit = createConcurrencyLimiter(options.maxConcurrency ?? 4)

	function get(key: string) {
		return resolved.get(key)
	}

	function has(key: string) {
		return resolved.has(key)
	}

	function resolve(record: RecordHistoryRow): Promise<number | null> {
		const key = recordRankLookupKey(record)
		if (!key) return Promise.resolve(null)
		if (resolved.has(key)) return Promise.resolve(resolved.get(key) ?? null)

		const existing = inFlight.get(key)
		if (existing) return existing

		const request = limit(() =>
			fetchFasterCount({ levelId: record.levelId, time: record.time }),
		)
			.catch(() => null)
			.then((fasterCount) => {
				const validRank = personalBestRankFromFasterCount(fasterCount)
				resolved.set(key, validRank)
				options.onResolved?.(key, validRank)
				return validRank
			})
			.finally(() => {
				inFlight.delete(key)
			})

		inFlight.set(key, request)
		return request
	}

	return { get, has, resolve }
}
