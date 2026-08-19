import type { MaybeRefOrGetter, Ref } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'

export type UseUserProfileOptions = {
	favouritesActive?: MaybeRefOrGetter<boolean>
	recordsActive?: MaybeRefOrGetter<boolean>
	summary?: UserProfileSummaryModel
	viewerId?: Ref<number | undefined>
	workshopActive?: MaybeRefOrGetter<boolean>
}

export function useUserProfile(steamId: Ref<string>, options: UseUserProfileOptions = {}) {
	const summaryData = options.summary ?? useUserProfileSummary(steamId)
	const career = useUserCareer(steamId, summaryData)
	const superLeague = useUserSuperLeague(steamId, summaryData, career.careerActive)
	const results = useUserResults(steamId, summaryData, options.recordsActive ?? true)
	const viewerId = options.viewerId ?? computed(() => undefined)
	const profileUserId = computed(() => summaryData.user.value?.id)
	const levels = useUserLevels(steamId, summaryData, options.workshopActive ?? true, viewerId)
	const favourites = useUserFavouriteLevels(
		profileUserId,
		viewerId,
		options.favouritesActive ?? true,
	)

	async function prefetchCritical() {
		await summaryData.prefetchCritical()
	}

	return {
		...career,
		...favourites,
		...levels,
		...results,
		...superLeague,
		prefetchCritical,
		profile: summaryData.profile,
		summary: summaryData.summary,
		user: summaryData.user,
		voteDistribution: summaryData.voteDistribution,
	}
}
