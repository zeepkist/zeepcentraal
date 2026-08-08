import { useQuery } from '@urql/vue'
import { Zc_RecordDetailSummaryDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { RecordHeroSource } from '~/types/recordDetail'

export function useRecordDetailSummary(recordId: Ref<number>) {
	const detail = useQuery({
		query: Zc_RecordDetailSummaryDocument,
		variables: computed(() => ({ recordId: recordId.value })),
	})
	const record = computed(() => detail.data.value?.record ?? null)
	const hero = computed<RecordHeroSource | null>(() => {
		const value = record.value
		if (!value) return null

		return {
			recordId: value.id,
			userSteamId: value.user?.steamId == null ? null : String(value.user.steamId),
			userName: value.user?.steamName ?? null,
			time: value.time,
			dateCreated: String(value.dateCreated),
			isWorldRecord: value.worldRecordGlobals.totalCount > 0,
			isPersonalBest: value.personalBestGlobals.totalCount > 0,
		}
	})
	const levelItem = computed(() => record.value?.level?.levelItems.nodes[0] ?? null)

	async function prefetchCritical() {
		if (import.meta.server) await detail
	}

	return {
		detail,
		hero,
		levelItem,
		record,
		prefetchCritical,
	}
}
