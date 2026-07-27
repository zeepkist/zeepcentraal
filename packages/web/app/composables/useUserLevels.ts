import { useQuery } from '@urql/vue'
import type { MaybeRefOrGetter } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'
import { type Zc_UserLevelCardFragment, Zc_UserLevelsDocument } from '~/graphql/generated/graphql'
import type { LevelSummary } from '~/types/app'
import { getLevelDisplayName } from '~/utils/levelDisplay'
import { getLevelHotWindows } from '~/utils/levelExplorer'

function mapUserLevel(
	level: Zc_UserLevelCardFragment,
	recordCount = level.records.totalCount,
): LevelSummary {
	const item = level.levelItems.nodes[0]
	return {
		id: level.id,
		xxHash: level.xxHash,
		name: getLevelDisplayName(item?.name, level.xxHash),
		imageUrl: item?.imageUrl,
		authorName: item?.author?.steamName,
		authorSteamId: item?.author?.steamId == null ? null : String(item.author.steamId),
		adventure: level.adventure,
		dateCreated: String(level.dateCreated),
		points: level.levelPoints?.points,
		rating: level.levelPoints?.rating,
		recordCount,
		personalBestCount: level.personalBestGlobals.totalCount,
		voteCount: level.votes.totalCount,
		worldRecordTime: level.worldRecordGlobal?.record?.time,
		worldRecordAuthorName: level.worldRecordGlobal?.user?.steamName,
		worldRecordAuthorSteamId:
			level.worldRecordGlobal?.user?.steamId == null
				? null
				: String(level.worldRecordGlobal.user.steamId),
		medals: item
			? {
					author: item.validationTimeAuthor,
					gold: item.validationTimeGold,
					silver: item.validationTimeSilver,
					bronze: item.validationTimeBronze,
				}
			: null,
	}
}

export function useUserLevels(
	steamId: Ref<string>,
	summaryData: UserProfileSummaryModel,
	active: MaybeRefOrGetter<boolean>,
) {
	const levelsPrefetch = useViewportPrefetch()
	const levelWindows = useState(`user-level-windows:${steamId.value}`, () => getLevelHotWindows())
	const userId = computed(() => summaryData.user.value?.id)
	const levelsQuery = useQuery({
		query: Zc_UserLevelsDocument,
		variables: computed(() => ({
			userId: userId.value ?? 0,
			steamId: steamId.value,
			since: levelWindows.value.yearSince,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				!levelsPrefetch.active.value,
		),
	})
	const recentLevels = computed<LevelSummary[]>(() =>
		(levelsQuery.data.value?.recentUser?.levelItems.nodes ?? []).flatMap(({ level }) =>
			level ? [mapUserLevel(level)] : [],
		),
	)
	const popularLevels = computed<LevelSummary[]>(() =>
		(levelsQuery.data.value?.popularLevels?.nodes ?? []).map((level) =>
			mapUserLevel(level, level.periodRecords.totalCount),
		),
	)

	return {
		levelsActive: levelsPrefetch.active,
		levelsQuery,
		levelsTarget: levelsPrefetch.target,
		popularLevels,
		recentLevels,
	}
}
