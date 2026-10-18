import { useClientHandle } from '@urql/vue'
import { Zc_GlobalMetricsDocument } from '@zeepkist/graphql/generated'
import { normalizeGlobalMetrics } from '~/utils/globalMetrics'

/** One SSR fetch, reused during hydration. No subscription or automatic refresh. */
export function useGlobalMetrics() {
	const { client } = useClientHandle()
	return useAsyncData(
		'global-metrics',
		async () => {
			const result = await client
				.query(Zc_GlobalMetricsDocument, {}, { requestPolicy: 'network-only' })
				.toPromise()
			if (result.error || !result.data?.globalMetrics) {
				throw createError({ statusCode: 503, statusMessage: 'Global metrics unavailable' })
			}
			return normalizeGlobalMetrics(result.data.globalMetrics)
		},
		{ watch: [], deep: false },
	)
}
