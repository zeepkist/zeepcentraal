import type { Zc_AdventurePlayerLevelFragment } from '@zeepkist/graphql/generated'
import { adventureRecordMilliseconds } from './adventureLeaderboard'
import { ADVENTURE_SERIES, adventureLevelNumber, findAdventureSeries } from './adventureSeries'

export type AdventurePlayerLevel = {
	id: number
	series: string
	xxHash: string
	name: string
	item: Zc_AdventurePlayerLevelFragment['levelItem']
	pb: { id: number; milliseconds: number } | null
	worldRecord: { id: number; milliseconds: number } | null
	delta: number | null
}

const seriesOrder = (slug: string) => ADVENTURE_SERIES.findIndex((series) => series.slug === slug)

export function mapAdventurePlayerLevels(
	memberships: Zc_AdventurePlayerLevelFragment[],
): AdventurePlayerLevel[] {
	const unique = new Map<number, AdventurePlayerLevel>()
	for (const membership of [...memberships].sort(
		(left, right) => seriesOrder(left.series) - seriesOrder(right.series),
	)) {
		const level = membership.level
		if (!level || unique.has(level.id)) continue
		const personalBest = level.personalBestGlobals?.nodes[0]?.record
		const wr = level.worldRecordGlobal?.record
		const pb = personalBest
			? { id: personalBest.id, milliseconds: adventureRecordMilliseconds(personalBest.time) }
			: null
		const worldRecord = wr
			? { id: wr.id, milliseconds: adventureRecordMilliseconds(wr.time) }
			: null
		unique.set(level.id, {
			id: level.id,
			series: membership.series,
			xxHash: level.xxHash,
			name: membership.levelItem?.name ?? level.xxHash.slice(0, 10),
			item: membership.levelItem,
			pb,
			worldRecord,
			delta: pb && worldRecord ? pb.milliseconds - worldRecord.milliseconds : null,
		})
	}
	return [...unique.values()]
}

export function groupAdventurePlayerLevels(levels: AdventurePlayerLevel[], sort: 'level' | 'gap') {
	return ADVENTURE_SERIES.flatMap((series) => {
		const rows = levels.filter((level) => level.series === series.slug)
		if (!rows.length) return []
		rows.sort((left, right) => {
			if (sort === 'gap') {
				const missing = Number(left.pb !== null) - Number(right.pb !== null)
				if (missing) return missing
				if (left.delta !== right.delta) {
					if (left.delta === null) return 1
					if (right.delta === null) return -1
					return right.delta - left.delta
				}
			}
			return (
				(adventureLevelNumber(left.name, series) ?? Number.MAX_SAFE_INTEGER) -
					(adventureLevelNumber(right.name, series) ?? Number.MAX_SAFE_INTEGER) ||
				left.id - right.id
			)
		})
		return [{ series, levels: rows }]
	})
}

export function adventurePlaylistPath(series?: string, missing = false): string {
	const parameters = new URLSearchParams()
	if (series && findAdventureSeries(series)) parameters.set('series', series)
	if (missing) parameters.set('missing', 'true')
	return `/api/adventure/playlist${parameters.size ? `?${parameters}` : ''}`
}
