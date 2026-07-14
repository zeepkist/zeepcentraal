import { useQuery } from '@urql/vue'
import { Zc_AdventureLevelsDocument } from '~/graphql/generated/graphql'
import type { LevelSummary } from '~/types/app'

export type AdventureSeries = { key: string; levels: LevelSummary[] }

export function useAdventure() {
	const result = useQuery({ query: Zc_AdventureLevelsDocument, variables: {} })
	const levels = computed<LevelSummary[]>(() =>
		(result.data.value?.levels?.nodes ?? []).map((node) => {
			const item = node.levelItems.nodes[0]
			return {
				id: node.id,
				xxHash: node.xxHash,
				name: item?.name ?? node.xxHash,
				imageUrl: item?.imageUrl,
				authorName: item?.author?.steamName,
				authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
				adventure: node.adventure,
				dateCreated: String(node.dateCreated),
				points: node.levelPoints?.points,
				rating: node.levelPoints?.rating,
				popularity: node.levelPoints?.modifierPopularity,
				recordCount: node.records.totalCount,
				personalBestCount: node.personalBestGlobals.totalCount,
			}
		}),
	)
	const series = computed<AdventureSeries[]>(() => {
		const groups = new Map<string, LevelSummary[]>()
		for (const level of levels.value) {
			const key = /^([A-Z]+)-\d+/i.exec(level.name)?.[1]?.toUpperCase() ?? 'OTHER'
			groups.set(key, [...(groups.get(key) ?? []), level])
		}
		return [...groups].map(([key, groupedLevels]) => ({ key, levels: groupedLevels }))
	})
	return { levels, result, series }
}
