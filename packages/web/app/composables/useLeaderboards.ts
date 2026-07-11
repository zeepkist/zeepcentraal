import { useQuery } from '@urql/vue'
import ZcLeaderboardsQuery from '~/graphql/queries/leaderboards.graphql'

export function useLeaderboards(first = 10) {
	return useQuery({
		query: ZcLeaderboardsQuery,
		variables: { first },
	})
}
