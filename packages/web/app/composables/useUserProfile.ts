import type { MaybeRefOrGetter } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'

export type UseUserProfileOptions = {
	recordsActive?: MaybeRefOrGetter<boolean>
	summary?: UserProfileSummaryModel
	workshopActive?: MaybeRefOrGetter<boolean>
}

export function useUserProfile(steamId: Ref<string>, options: UseUserProfileOptions = {}) {
	const summaryData = options.summary ?? useUserProfileSummary(steamId)
	const career = useUserCareer(steamId, summaryData)
	const superLeague = useUserSuperLeague(steamId, summaryData, career.careerActive)
	const results = useUserResults(steamId, summaryData, options.recordsActive ?? true)
	const levels = useUserLevels(steamId, summaryData, options.workshopActive ?? true)

	async function prefetchCritical() {
		await summaryData.prefetchCritical()
	}

	return {
		...career,
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
