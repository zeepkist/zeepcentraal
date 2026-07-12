import { useQuery } from '@urql/vue'
import {
	calculateDecayMultiplier,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
} from '@zeepkist/core/score'
import type { Ref } from 'vue'
import { Zc_MyRecordCountDocument, Zc_MyRecordsDocument } from '~/graphql/generated/graphql'
import type { CursorPage, MyRecordRow } from '~/types/app'
import type { MyRecordView } from '~/utils/myRecords'

function pageInfo(
	info?: {
		startCursor?: unknown
		endCursor?: unknown
		hasNextPage: boolean
		hasPreviousPage: boolean
	} | null,
): CursorPage {
	return info
		? {
				startCursor: String(info.startCursor ?? '') || null,
				endCursor: String(info.endCursor ?? '') || null,
				hasNextPage: info.hasNextPage,
				hasPreviousPage: info.hasPreviousPage,
			}
		: { hasNextPage: false, hasPreviousPage: false }
}

export function useMyRecords(userId: Ref<number>, view: Ref<MyRecordView>) {
	const pagination = useCursorPagination(25, 'myRecords')
	const countResult = useQuery({
		query: Zc_MyRecordCountDocument,
		variables: computed(() => ({ id: userId.value })),
		pause: computed(() => userId.value < 1),
	})
	const filter = computed(() => {
		const base = { userId: { equalTo: userId.value } }
		if (view.value === 'personal-bests') {
			return {
				...base,
				personalBestGlobalsExist: true,
				worldRecordGlobalsExist: false,
			}
		}
		if (view.value === 'world-records') {
			return { ...base, worldRecordGlobalsExist: true }
		}
		return base
	})
	const result = useQuery({
		query: Zc_MyRecordsDocument,
		variables: computed(() => ({
			...pagination.variables.value,
			filter: filter.value,
		})),
		pause: computed(() => userId.value < 1),
	})
	const rows = computed<MyRecordRow[]>(() =>
		(result.data.value?.records?.edges ?? []).flatMap(({ node }) => {
			if (!node.level) return []
			const contribution = node.userPointContributions.nodes[0]
			return [
				{
					id: node.id,
					time: node.time,
					dateCreated: String(node.dateCreated),
					levelId: node.levelId,
					levelXxHash: node.level.xxHash,
					levelName: node.level.levelItems.nodes[0]?.name ?? node.level.xxHash,
					levelPosition: contribution?.levelPosition,
					contributionRank: contribution?.contributionRank,
					levelDecayedPoints: contribution?.levelDecayedPoints,
					playerDecayedPoints: contribution?.playerDecayedPoints,
					levelDecayMultiplier: contribution
						? calculateDecayMultiplier(contribution.levelPosition, LEVEL_DECAY_FACTOR)
						: undefined,
					globalDecayMultiplier: contribution
						? calculateDecayMultiplier(
								contribution.contributionRank,
								GLOBAL_DECAY_FACTOR,
							)
						: undefined,
				},
			]
		}),
	)
	const page = computed(() => pageInfo(result.data.value?.records?.pageInfo))
	const totalRecords = computed(() => countResult.data.value?.user?.records.totalCount)

	async function setView(next: MyRecordView) {
		await pagination.reset({ view: next === 'recent' ? undefined : next })
	}

	return {
		countResult,
		page,
		pagination,
		result,
		rows,
		setView,
		totalRecords,
	}
}
