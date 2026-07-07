import { useQuery } from '@urql/vue'
import ZcLevelsQuery from '~/graphql/queries/levels.graphql'

export function useLevels(first = 10) {
	return useQuery({
		query: ZcLevelsQuery,
		variables: { first },
	})
}
