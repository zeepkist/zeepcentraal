import { useQuery } from '@urql/vue'
import type { Ref } from 'vue'
import { Zc_MyRecordCountDocument } from '~/graphql/generated/graphql'
import type { RecordHistorySort, RecordHistoryView } from '~/utils/recordHistory'

export function useMyRecords(
	userId: Ref<number | undefined>,
	view: Ref<RecordHistoryView>,
	sort: Ref<RecordHistorySort>,
) {
	const history = useRecordHistory({ userId, view, sort, namespace: 'myRecords' })
	const countResult = useQuery({
		query: Zc_MyRecordCountDocument,
		variables: computed(() => ({ id: userId.value ?? -1 })),
		pause: computed(() => !userId.value),
	})
	const totalRecords = computed(() => countResult.data.value?.user?.records.totalCount)

	return {
		...history,
		countResult,
		totalRecords,
	}
}
