import { calculatePlayerPointsDecayed, LEVEL_DECAY_FACTOR } from '@zeepkist/core/score'
import type { RecordResultStatus } from '~/types/app'

type RankAggregate = {
	keys?: Array<string | null> | null
	distinctCount?: { id?: unknown } | null
}

type RecordStatusRelations = {
	personalBestGlobals?: { totalCount: number } | null
	worldRecordGlobals?: { totalCount: number } | null
}

export function buildLevelPersonalBestRanks(
	fasterPersonalBestCount: unknown,
	groups?: RankAggregate[] | null,
) {
	const countsByTime = new Map<number, number>()
	for (const group of groups ?? []) {
		const timeKey = group.keys?.[0]
		if (timeKey == null) continue
		const time = Number(timeKey)
		const count = Number(group.distinctCount?.id)
		if (!Number.isFinite(time) || !Number.isFinite(count) || count < 1) continue
		countsByTime.set(time, (countsByTime.get(time) ?? 0) + count)
	}

	const fasterCount = Number(fasterPersonalBestCount)
	let rank = Number.isFinite(fasterCount) && fasterCount >= 0 ? fasterCount + 1 : 1
	const ranks = new Map<number, number>()
	for (const [time, count] of [...countsByTime.entries()].sort(
		([left], [right]) => left - right,
	)) {
		ranks.set(time, rank)
		rank += count
	}

	return ranks
}

export function resolveRecordPbOrWr(record: RecordStatusRelations): RecordResultStatus | null {
	if ((record.worldRecordGlobals?.totalCount ?? 0) > 0) return 'world-record'
	if ((record.personalBestGlobals?.totalCount ?? 0) > 0) return 'personal-best'
	return null
}

export function calculateLevelPersonalBestPoints(
	levelPoints: number | null | undefined,
	rank: number | null | undefined,
) {
	if (levelPoints == null || rank == null) return null
	return calculatePlayerPointsDecayed(levelPoints, rank, LEVEL_DECAY_FACTOR)
}
