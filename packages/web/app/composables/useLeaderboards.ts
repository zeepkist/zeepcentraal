import { useQuery } from '@urql/vue'
import { Zc_LeaderboardsDocument } from '@zeepkist/graphql/generated'

export function useLeaderboards(first = 10) {
	return useQuery({
		query: Zc_LeaderboardsDocument,
		variables: { first },
	})
}
