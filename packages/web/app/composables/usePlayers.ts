import { useQuery } from '@urql/vue'
import ZcPlayersQuery from '~/graphql/queries/players.graphql'

export function usePlayers(first = 10) {
	return useQuery({
		query: ZcPlayersQuery,
		variables: { first },
	})
}
