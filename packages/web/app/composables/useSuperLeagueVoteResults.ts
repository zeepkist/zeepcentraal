import type { VoteResultsSnapshot } from '~/utils/superLeagueVoteResults'
import { voteResultMarkers } from '~/utils/superLeagueVoteResults'

export function useSuperLeagueVoteResults(roundId: MaybeRef<number | undefined>) {
	const identity = computed(() => `zsl-vote-results:${toValue(roundId) ?? 'pending'}`)
	const request = useAsyncData(identity, async (_app, { signal }) => {
		const owner = identity.value
		const id = toValue(roundId)
		if (!id) return { owner, result: null as VoteResultsSnapshot | null }
		const result = await $fetch<VoteResultsSnapshot>('/api/super-league/vote-results', {
			query: { roundId: id },
			signal,
			credentials: 'omit',
		})
		return { owner, result }
	})
	const snapshot = computed(() =>
		request.data.value?.owner === identity.value &&
		request.data.value.result?.roundId === toValue(roundId)
			? request.data.value.result
			: null,
	)
	const viewer = useSuperLeagueVote(
		roundId,
		computed(() => !!toValue(roundId)),
	)
	const markers = computed(() => voteResultMarkers(toValue(roundId), viewer.snapshot.value))
	const deadlines = computed(
		() =>
			snapshot.value?.categories
				.filter((category) => category.state === 'pending')
				.map((category) => category.deadline) ?? [],
	)
	const refresh = async () => {
		await Promise.all([request.refresh(), viewer.refresh()])
	}
	useContestDeadlineRefresh(deadlines, refresh)
	return {
		snapshot,
		markers,
		pending: computed(
			() => !!toValue(roundId) && !snapshot.value && request.status.value !== 'error',
		),
		error: computed(() => request.error.value?.message ?? null),
		refresh,
		initial: Promise.all([request, viewer.initial]),
	}
}
