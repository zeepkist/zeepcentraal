import type { GhostRecordSource } from '~/types/ghost'
import type { LevelGhostPresetCount, LevelGhostPresetKind } from '~/types/levelGhostExplorer'

export const LEVEL_GHOST_INDIVIDUAL_LIMIT = 10
export const LEVEL_GHOST_FOLLOW_LIMIT = 12

export function isLevelGhostPresetCount(value: number): value is LevelGhostPresetCount {
	return (
		value === 3 ||
		value === 5 ||
		value === 10 ||
		value === 25 ||
		value === 50 ||
		value === 100 ||
		value === 200
	)
}

export function buildLevelGhostPresetFilter(
	kind: LevelGhostPresetKind,
	levelId: number,
	viewerId?: number,
) {
	const filter = {
		levelId: { equalTo: levelId },
		recordMedia: { ghostUrl: { isNull: false } },
		recordMediaExists: true,
	}

	if (kind === 'personal-bests') {
		return { ...filter, personalBestGlobalsExist: true }
	}
	if (kind === 'viewer-records') {
		return viewerId === undefined ? null : { ...filter, userId: { equalTo: viewerId } }
	}
	return filter
}

function usableSource(source: GhostRecordSource | null | undefined): source is GhostRecordSource {
	return Boolean(source?.ghostUrl)
}

export function deduplicateLevelGhostSources(
	sources: readonly (GhostRecordSource | null | undefined)[],
): GhostRecordSource[] {
	const seen = new Set<number>()
	const result: GhostRecordSource[] = []

	for (const source of sources) {
		if (!usableSource(source) || seen.has(source.recordId)) continue
		seen.add(source.recordId)
		result.push(source)
	}

	return result
}

export function buildInitialLevelGhostSelection(
	viewerPersonalBest: GhostRecordSource | null | undefined,
	worldRecord: GhostRecordSource | null | undefined,
): GhostRecordSource[] {
	return deduplicateLevelGhostSources([viewerPersonalBest, worldRecord])
}

export function buildPresetLevelGhostSelection(
	viewerPersonalBest: GhostRecordSource | null | undefined,
	worldRecord: GhostRecordSource | null | undefined,
	preset: readonly GhostRecordSource[],
): GhostRecordSource[] {
	return deduplicateLevelGhostSources([viewerPersonalBest, worldRecord, ...preset])
}

export function clearLevelGhostSelection(): GhostRecordSource[] {
	return []
}

export function isLevelGhostBulkLocked(sources: readonly GhostRecordSource[]): boolean {
	return sources.length > LEVEL_GHOST_INDIVIDUAL_LIMIT
}

export function addIndividualLevelGhost(
	sources: readonly GhostRecordSource[],
	source: GhostRecordSource | null | undefined,
): GhostRecordSource[] {
	if (!usableSource(source) || sources.some((item) => item.recordId === source.recordId)) {
		return [...sources]
	}
	if (sources.length >= LEVEL_GHOST_INDIVIDUAL_LIMIT) return [...sources]
	return [...sources, source]
}

export function removeIndividualLevelGhost(
	sources: readonly GhostRecordSource[],
	recordId: number,
): GhostRecordSource[] {
	if (isLevelGhostBulkLocked(sources)) return [...sources]
	return sources.filter((source) => source.recordId !== recordId)
}

export type BuildLevelGhostFollowOrderOptions = {
	sources: readonly GhostRecordSource[]
	viewerPersonalBest?: GhostRecordSource | null
	worldRecord?: GhostRecordSource | null
	unavailableRecordIds?: ReadonlySet<number>
}

export function buildLevelGhostFollowRecordIds({
	sources,
	viewerPersonalBest,
	worldRecord,
	unavailableRecordIds,
}: BuildLevelGhostFollowOrderOptions): number[] {
	const available = sources.filter(
		(source) => !unavailableRecordIds?.has(source.recordId) && usableSource(source),
	)
	const activeIds = new Set(available.map((source) => source.recordId))
	const pinned = [viewerPersonalBest, worldRecord].filter(
		(source): source is GhostRecordSource =>
			usableSource(source) &&
			activeIds.has(source.recordId) &&
			!unavailableRecordIds?.has(source.recordId),
	)
	const fastest = [...available].sort(
		(left, right) => left.time - right.time || left.recordId - right.recordId,
	)

	return deduplicateLevelGhostSources([...pinned, ...fastest])
		.slice(0, LEVEL_GHOST_FOLLOW_LIMIT)
		.map((source) => source.recordId)
}
