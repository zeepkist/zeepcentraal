import { useClientHandle } from '@urql/vue'
import { Zc_RecordPersonalBestRankDocument } from '@zeepkist/graphql/generated'
import type { ComputedRef, Ref } from 'vue'
import type { RecordHistoryRow } from '~/types/app'
import {
	createRecordRankResolver,
	enrichRecordWithPersonalBestRank,
	recordRankLookupKey,
} from '~/utils/recordRankFallback'

export function useRecordRankFallback(
	source: Ref<RecordHistoryRow[]> | ComputedRef<RecordHistoryRow[]>,
) {
	const { client } = useClientHandle()
	const mounted = ref(false)
	const revision = ref(0)
	let disposed = false
	const resolver = createRecordRankResolver(
		async ({ levelId, time }) => {
			const result = await client
				.query(
					Zc_RecordPersonalBestRankDocument,
					{ levelId, time },
					{ requestPolicy: 'network-only' },
				)
				.toPromise()
			if (result.error) throw result.error
			return result.data?.fasterPersonalBests?.totalCount
		},
		{
			maxConcurrency: 4,
			onResolved: () => {
				if (!disposed) revision.value += 1
			},
		},
	)

	function requestMissingRanks(records: RecordHistoryRow[]) {
		if (!mounted.value || import.meta.server) return
		for (const record of records) {
			if (recordRankLookupKey(record)) void resolver.resolve(record)
		}
	}

	const rows = computed(() => {
		void revision.value
		return source.value.map((record) => {
			const key = recordRankLookupKey(record)
			if (!key || !resolver.has(key)) return record
			const rank = resolver.get(key)
			return rank == null ? record : enrichRecordWithPersonalBestRank(record, rank)
		})
	})

	watch(source, requestMissingRanks)
	onMounted(() => {
		mounted.value = true
		requestMissingRanks(source.value)
	})
	onScopeDispose(() => {
		disposed = true
	})

	return rows
}
