import { useQuery } from '@urql/vue'
import { Zc_UserProfileDocument } from '@zeepkist/graphql/generated'
import type { UserProfileSummary } from '~/types/app'
import { buildVoteDistributionCounts } from '~/utils/voteDistribution'

export function useUserProfileSummary(steamId: Ref<string>) {
	const profile = useQuery({
		query: Zc_UserProfileDocument,
		variables: computed(() => ({ steamId: steamId.value })),
	})
	const user = computed(() => profile.data.value?.users?.nodes[0])
	const summary = computed<UserProfileSummary | null>(() => {
		const value = user.value
		if (!value) return null
		return {
			id: value.id,
			steamId: String(value.steamId),
			steamName: value.steamName,
			dateCreated: String(value.dateCreated),
			rank: value.userPoints?.rank ?? null,
			rankedPoints: value.userPoints?.points ?? 0,
			totalPoints: value.userPoints?.totalPoints ?? 0,
			records: value.records.totalCount,
			personalBests: value.userPoints?.personalBests ?? 0,
			worldRecords: value.userPoints?.worldRecords ?? 0,
			levels: value.levelItems.totalCount,
		}
	})
	const voteDistribution = computed(() =>
		buildVoteDistributionCounts(
			user.value?.votes.groupedAggregates,
			user.value?.votes.totalCount ?? 0,
		),
	)
	useDiscordComponentEmbed(() =>
		summary.value
			? {
					title: summary.value.steamName ?? summary.value.steamId,
					description: `Rank ${summary.value.rank ?? 'unavailable'} | ${summary.value.rankedPoints.toLocaleString('en-GB')} points | ${summary.value.personalBests} personal bests | ${summary.value.worldRecords} world records`,
					links: [
						{ label: 'Created levels', url: `/levels?author=${summary.value.steamId}` },
						{ label: 'Player rankings', url: '/users' },
					],
				}
			: undefined,
	)

	async function prefetchCritical() {
		await profile
	}

	return { prefetchCritical, profile, summary, user, voteDistribution }
}

export type UserProfileSummaryModel = ReturnType<typeof useUserProfileSummary>
