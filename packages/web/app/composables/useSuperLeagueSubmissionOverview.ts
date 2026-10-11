import type { SubmissionOverview } from '~/utils/superLeagueSubmission'

export function useSuperLeagueSubmissionOverview(roundId: MaybeRef<number | undefined>) {
	const identity = computed(() => `zsl-submission-overview:${toValue(roundId) ?? 'current'}`)
	const read = useAsyncData(
		identity,
		async (_app, { signal }) => {
			const owner = identity.value
			const result = await $fetch<SubmissionOverview>(
				'/api/super-league/submission-overview',
				{
					query: { roundId: toValue(roundId) },
					signal,
				},
			)
			return { owner, result }
		},
		{ server: true, lazy: true },
	)
	const lastResult = shallowRef<typeof read.data.value>()
	watch(
		read.data,
		(value) => {
			if (value?.owner === identity.value) lastResult.value = value
		},
		{ immediate: true, flush: 'sync' },
	)
	watch(
		identity,
		() => {
			if (lastResult.value?.owner !== identity.value) lastResult.value = undefined
		},
		{ flush: 'sync' },
	)
	const snapshot = computed(() => read.data.value ?? lastResult.value)
	const data = computed(() =>
		snapshot.value?.owner === identity.value ? snapshot.value.result : null,
	)
	return {
		data,
		pending: computed(() => read.status.value === 'pending'),
		error: read.error,
		refresh: read.refresh,
		initial: read,
	}
}
