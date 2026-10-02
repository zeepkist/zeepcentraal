import { useQuery } from '@urql/vue'
import { Zc_WorkshopDetailDocument, Zc_WorkshopLevelsDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import { mapLevelSummary } from '~/utils/levelSummary'
import { isWorkshopId, mapWorkshopPage, mapWorkshopSummary } from '~/utils/workshop'

export function useWorkshopDetail(workshopId: Ref<string>, viewerId: Ref<number | undefined>) {
	const validId = computed(() => isWorkshopId(workshopId.value))
	const pagination = useCursorPagination(24, 'levels')
	const detail = useQuery({
		query: Zc_WorkshopDetailDocument,
		variables: computed(() => ({ workshopId: validId.value ? workshopId.value : '0' })),
		pause: computed(() => !validId.value),
	})
	const workshop = computed(() => {
		const value = detail.data.value?.workshopItem
		return validId.value && value && String(value.workshopId) === workshopId.value
			? mapWorkshopSummary(value)
			: null
	})
	const result = useQuery({
		query: Zc_WorkshopLevelsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			workshopId: validId.value ? workshopId.value : '0',
			viewerId: viewerId.value ?? 0,
			includeViewer: viewerId.value !== undefined,
		})),
		pause: computed(() => !workshop.value),
	})
	const levels = computed(() => (result.data.value?.levels?.nodes ?? []).map(mapLevelSummary))
	const page = computed(() => mapWorkshopPage(result.data.value?.levels?.pageInfo))
	onServerPrefetch(async () => {
		if (!validId.value) return
		await detail
		if (workshop.value) await result
	})
	return { detail, workshop, result, levels, page, pagination, validId }
}
