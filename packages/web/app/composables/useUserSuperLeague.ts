import { useQuery } from '@urql/vue'
import {
	Zc_UserSuperLeagueSeasonDocument,
	Zc_UserSuperLeagueSeasonsDocument,
} from '@zeepkist/graphql/generated'
import type { MaybeRefOrGetter } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'
import { buildUserSuperLeagueSummary } from '~/utils/userSuperLeague'

export function useUserSuperLeague(
	steamId: Ref<string>,
	summaryData: UserProfileSummaryModel,
	active: MaybeRefOrGetter<boolean>,
) {
	const userId = computed(() => summaryData.user.value?.id)
	const selectedSuperLeagueSeasonId = useState<number | undefined>(
		`user-super-league-season:${steamId.value}`,
		() => undefined,
	)
	const superLeagueSeasonsQuery = useQuery({
		query: Zc_UserSuperLeagueSeasonsDocument,
		variables: computed(() => ({ userId: userId.value ?? 0 })),
		pause: computed(() => import.meta.server || userId.value === undefined || !toValue(active)),
	})
	const superLeagueSeasons = computed(
		() => superLeagueSeasonsQuery.data.value?.zslSeasons?.nodes ?? [],
	)
	const currentSuperLeagueSeason = computed(() => {
		const season = superLeagueSeasonsQuery.data.value?.currentSeason?.nodes[0]
		return season ? buildUserSuperLeagueSummary(season) : null
	})
	watch(
		superLeagueSeasons,
		(seasons) => {
			if (
				seasons.length > 0 &&
				!seasons.some((season) => season.id === selectedSuperLeagueSeasonId.value)
			) {
				selectedSuperLeagueSeasonId.value = seasons[0]?.id
			}
		},
		{ immediate: true, flush: 'sync' },
	)
	const superLeagueSeasonQuery = useQuery({
		query: Zc_UserSuperLeagueSeasonDocument,
		variables: computed(() => ({
			seasonId: selectedSuperLeagueSeasonId.value ?? 0,
			userId: userId.value ?? 0,
		})),
		pause: computed(
			() =>
				import.meta.server ||
				userId.value === undefined ||
				!toValue(active) ||
				selectedSuperLeagueSeasonId.value === undefined ||
				selectedSuperLeagueSeasonId.value === currentSuperLeagueSeason.value?.id,
		),
	})
	const superLeagueSeason = computed(() => {
		if (selectedSuperLeagueSeasonId.value === currentSuperLeagueSeason.value?.id) {
			return currentSuperLeagueSeason.value
		}
		const season = superLeagueSeasonQuery.data.value?.zslSeason
		return season?.id === selectedSuperLeagueSeasonId.value
			? buildUserSuperLeagueSummary(season)
			: null
	})

	return {
		selectedSuperLeagueSeasonId,
		superLeagueSeason,
		superLeagueSeasonQuery,
		superLeagueSeasons,
		superLeagueSeasonsQuery,
	}
}
