import { useClientHandle } from '@urql/vue'
import { Zc_UserTrackTournamentResultsDocument } from '@zeepkist/graphql/generated'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { UserProfileSummaryModel } from '~/composables/useUserProfileSummary'
import type { CursorPage } from '~/types/app'
import type { TrackTournamentType, UserTrackTournamentResult } from '~/types/tournament'
import {
	mapUserTrackTournamentPage,
	mapUserTrackTournamentResults,
} from '~/utils/userTrackTournaments'

type TournamentSnapshot = {
	userId: number
	type: TrackTournamentType
	results: UserTrackTournamentResult[]
	page: CursorPage
	error?: string
}

/** Each owner/type/cursor page stays unchanged until a full page reload. */
export function useUserTrackTournaments(
	steamId: Ref<string>,
	summary: UserProfileSummaryModel,
	type: TrackTournamentType,
	active: MaybeRefOrGetter<boolean>,
) {
	const { client } = useClientHandle()
	const loading = new Set<string>()
	const pagination = useCursorPagination(6, type === 0 ? 'userTotw' : 'userTotm')
	const now = useState('user-track-tournament-now', () => new Date().toISOString())
	const snapshots = useState<Record<string, TournamentSnapshot>>(
		'user-track-tournament-snapshots',
		() => ({}),
	)
	const userId = computed(() =>
		summary.user.value && String(summary.user.value.steamId) === steamId.value
			? summary.user.value.id
			: undefined,
	)
	const variables = computed(() => ({
		userId: userId.value ?? 0,
		type,
		now: now.value,
		...pagination.variables.value,
	}))
	const key = computed(() => JSON.stringify(variables.value))
	const snapshot = computed(() =>
		userId.value === undefined ? undefined : snapshots.value[key.value],
	)
	const request = computed(() =>
		import.meta.server || userId.value === undefined || !toValue(active)
			? null
			: { key: key.value, variables: variables.value },
	)

	watch(
		request,
		async (request) => {
			if (!request || snapshots.value[request.key] || loading.has(request.key)) return
			loading.add(request.key)
			const neighbor = Object.values(snapshots.value).find(
				(snapshot) =>
					snapshot.userId === request.variables.userId &&
					snapshot.type === type &&
					((request.variables.after &&
						snapshot.page.endCursor === request.variables.after) ||
						(request.variables.before &&
							snapshot.page.startCursor === request.variables.before)),
			)
			let next: TournamentSnapshot
			try {
				const result = await client
					.query(Zc_UserTrackTournamentResultsDocument, request.variables, {
						requestPolicy: 'cache-first',
					})
					.toPromise()
				next = {
					userId: request.variables.userId,
					type,
					results: mapUserTrackTournamentResults(
						result.data?.trackTournaments,
						request.variables.userId,
					),
					page: mapUserTrackTournamentPage(result.data?.trackTournaments),
					error: result.error?.message,
				}
			} catch (error) {
				next = {
					userId: request.variables.userId,
					type,
					results: [],
					page: mapUserTrackTournamentPage(),
					error: error instanceof Error ? error.message : String(error),
				}
			}
			snapshots.value = { ...snapshots.value, [request.key]: next }
			// Forward/backward cursor requests can represent the same already visited page.
			if (neighbor && !next.error) {
				const inverseCursor = request.variables.after
					? next.page.startCursor && { last: 6, before: next.page.startCursor }
					: request.variables.before &&
						next.page.endCursor && { first: 6, after: next.page.endCursor }
				if (inverseCursor) {
					const inverseKey = JSON.stringify({
						userId: request.variables.userId,
						type,
						now: request.variables.now,
						...inverseCursor,
					})
					snapshots.value = { ...snapshots.value, [inverseKey]: neighbor }
				}
			}
			loading.delete(request.key)
		},
		{ immediate: true },
	)

	return {
		results: computed(() => snapshot.value?.results ?? []),
		page: computed(() => snapshot.value?.page ?? mapUserTrackTournamentPage()),
		pending: computed(() => snapshot.value === undefined),
		error: computed(() => snapshot.value?.error),
		pagination,
	}
}
