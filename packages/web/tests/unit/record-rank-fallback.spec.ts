import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { RecordHistoryRow } from '../../app/types/app'
import {
	createRecordRankResolver,
	enrichRecordWithPersonalBestRank,
	personalBestRankFromFasterCount,
	recordRankLookupKey,
} from '../../app/utils/recordRankFallback'

function record(overrides: Partial<RecordHistoryRow> = {}): RecordHistoryRow {
	return {
		id: 1,
		time: 42,
		dateCreated: '2026-07-18T12:00:00Z',
		userId: 1,
		levelId: 7,
		levelXxHash: 'hash',
		levelName: 'Level',
		pbOrWr: 'personal-best',
		...overrides,
	}
}

async function waitUntil(predicate: () => boolean) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (predicate()) return
		await new Promise((resolve) => setTimeout(resolve, 0))
	}
	throw new Error('Condition was not reached')
}

describe('record rank fallback', () => {
	it('builds a lookup only for current PB or WR rows missing a rank', () => {
		expect(recordRankLookupKey(record())).toBe('7:42')
		expect(recordRankLookupKey(record({ pbOrWr: null }))).toBeNull()
		expect(recordRankLookupKey(record({ levelPosition: 3 }))).toBeNull()
	})

	it('uses faster PB count plus one so tied times share rank', () => {
		expect(personalBestRankFromFasterCount(0)).toBe(1)
		expect(personalBestRankFromFasterCount(4)).toBe(5)
		expect(personalBestRankFromFasterCount(-1)).toBeNull()
		expect(personalBestRankFromFasterCount(1.5)).toBeNull()
	})

	it('calculates missing level-decayed points and preserves stored values', () => {
		const enriched = enrichRecordWithPersonalBestRank(record({ levelPoints: 1000 }), 2)
		expect(enriched.levelPosition).toBe(2)
		expect(enriched.levelDecayMultiplier).toBeCloseTo(0.985)
		expect(enriched.levelDecayedPoints).toBeCloseTo(985)

		const stored = enrichRecordWithPersonalBestRank(
			record({ levelPoints: 1000, levelDecayedPoints: 777 }),
			2,
		)
		expect(stored.levelDecayedPoints).toBe(777)
		expect(enrichRecordWithPersonalBestRank(record(), 2).levelDecayedPoints).toBeUndefined()
	})

	it('deduplicates in-flight and resolved lookups', async () => {
		const fetchRank = vi.fn(async () => 2)
		const resolver = createRecordRankResolver(fetchRank)
		const row = record()
		const first = resolver.resolve(row)
		const duplicate = resolver.resolve(row)

		expect(first).toBe(duplicate)
		expect(await first).toBe(3)
		expect(await resolver.resolve(row)).toBe(3)
		expect(fetchRank).toHaveBeenCalledTimes(1)
	})

	it('limits rank lookups to four concurrent requests', async () => {
		let active = 0
		let peak = 0
		const releases: Array<() => void> = []
		const resolver = createRecordRankResolver(
			async () => {
				active += 1
				peak = Math.max(peak, active)
				await new Promise<void>((resolve) => releases.push(resolve))
				active -= 1
				return 0
			},
			{ maxConcurrency: 4 },
		)
		const requests = Array.from({ length: 6 }, (_, index) =>
			resolver.resolve(record({ levelId: index + 1, time: index + 1 })),
		)

		await waitUntil(() => active === 4)
		for (const release of releases.splice(0, 4)) release()
		await waitUntil(() => active === 2)
		for (const release of releases.splice(0, 2)) release()
		await expect(Promise.all(requests)).resolves.toEqual([1, 1, 1, 1, 1, 1])
		expect(peak).toBe(4)
	})

	it('keeps failed lookups non-blocking and cached', async () => {
		const fetchRank = vi.fn(async () => {
			throw new Error('network unavailable')
		})
		const resolver = createRecordRankResolver(fetchRank)

		await expect(resolver.resolve(record())).resolves.toBeNull()
		await expect(resolver.resolve(record())).resolves.toBeNull()
		expect(fetchRank).toHaveBeenCalledTimes(1)
	})

	it('uses a count-only query and requests current level points', () => {
		const rankQuery = readFileSync(
			new URL('../../app/graphql/queries/recordPersonalBestRank.graphql', import.meta.url),
			'utf8',
		)
		const historyQuery = readFileSync(
			new URL('../../app/graphql/queries/recordHistory.graphql', import.meta.url),
			'utf8',
		)

		expect(rankQuery).toContain('query ZC_RecordPersonalBestRank')
		expect(rankQuery).toContain('first: 0')
		expect(rankQuery).toContain('personalBestGlobalsExist: true')
		expect(rankQuery).toContain('time: { lessThan: $time }')
		expect(rankQuery).not.toContain('nodes {')
		expect(historyQuery).toMatch(/\n\tlevelPoints\n/)
	})
})
