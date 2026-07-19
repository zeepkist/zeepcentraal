import { useQuery } from '@urql/vue'
import type { Ref } from 'vue'
import { Zc_RecordDetailDocument } from '~/graphql/generated/graphql'
import type { GhostRecordSource } from '~/types/ghost'
import { mapGhostRecordSource } from '~/utils/ghostRecordSource'

export function useRecordDetail(recordId: Ref<number>) {
	const detail = useQuery({
		query: Zc_RecordDetailDocument,
		variables: computed(() => ({ recordId: recordId.value })),
	})
	const record = computed(() => detail.data.value?.record ?? null)
	const source = computed<GhostRecordSource | null>(() => {
		const value = record.value
		return value ? mapGhostRecordSource(value) : null
	})
	const worldRecord = computed<GhostRecordSource | null>(() => {
		const value = record.value?.level?.worldRecordGlobal?.record
		return value ? mapGhostRecordSource(value) : null
	})
	const levelItem = computed(() => record.value?.level?.levelItems.nodes[0] ?? null)

	async function prefetchCritical() {
		if (import.meta.server) await detail
	}

	return {
		detail,
		levelItem,
		record,
		source,
		worldRecord,
		prefetchCritical,
	}
}
