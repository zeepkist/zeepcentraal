import type { LevelSubmission, SubmissionContest } from '~/utils/superLeagueSubmission'
import { submissionProcessing } from '~/utils/superLeagueSubmission'

export function useSuperLeagueSubmission(roundId: MaybeRef<number | undefined>) {
	const config = useRuntimeConfig()
	const session = useSessionStore()
	const contest = shallowRef<SubmissionContest | null>(null)
	const submission = shallowRef<LevelSubmission | null>(null)
	const loading = ref(false)
	const saving = ref(false)
	const error = ref<string | null>(null)
	let timer: ReturnType<typeof setTimeout> | undefined
	let generation = 0
	let alive = true
	let pollError = false
	const endpoint = (path: string) =>
		new URL(`/super-league/${path}`, String(config.public.backendUrl)).toString()
	function stop() {
		clearTimeout(timer)
		generation++
	}
	function schedule() {
		clearTimeout(timer)
		if (alive && session.user && submissionProcessing(submission.value?.status))
			timer = setTimeout(poll, 2000)
	}
	async function poll() {
		if (!session.user || !submission.value || !alive) return
		const current = generation
		try {
			const next = await $fetch<LevelSubmission>(
				endpoint(`submission-status/${submission.value.id}`),
				{ credentials: 'include' },
			)
			if (current === generation) {
				submission.value = next
				if (pollError) error.value = null
				pollError = false
			}
		} catch {
			if (current === generation) {
				error.value = 'Could not check your submission. Trying again…'
				pollError = true
			}
		}
		if (current === generation) schedule()
	}
	async function refresh() {
		stop()
		if (!session.user || !alive) {
			submission.value = null
			contest.value = null
			loading.value = false
			return
		}
		const current = generation
		loading.value = true
		try {
			const result = await $fetch<{
				contest: SubmissionContest | null
				submission: LevelSubmission | null
			}>(endpoint('submit-level'), {
				credentials: 'include',
				query: { roundId: toValue(roundId) },
			})
			if (current === generation) {
				contest.value = result.contest
				submission.value = result.submission
				error.value = null
				schedule()
			}
		} catch {
			if (current === generation) error.value = 'Could not load your submission.'
		} finally {
			if (current === generation) loading.value = false
		}
	}
	async function save(workshopId: string, authors: string[]) {
		if (!contest.value || saving.value) return
		stop()
		saving.value = true
		error.value = null
		try {
			await $fetch<number>(endpoint('submit-level'), {
				method: 'POST',
				credentials: 'include',
				body: { roundId: contest.value.roundId, workshopId, authors },
			})
			await refresh()
		} catch (cause) {
			const detail = (cause as { data?: { detail?: string } }).data?.detail
			error.value = detail ?? 'Could not save your submission. Please try again.'
		} finally {
			saving.value = false
			schedule()
		}
	}
	async function withdraw() {
		if (!contest.value || saving.value) return
		stop()
		saving.value = true
		try {
			await $fetch(endpoint('submit-level'), {
				method: 'DELETE',
				credentials: 'include',
				query: { roundId: contest.value.roundId },
			})
			await refresh()
		} catch {
			error.value = 'Could not withdraw your submission.'
		} finally {
			saving.value = false
			schedule()
		}
	}
	onMounted(refresh)
	watch([() => session.user?.id, () => toValue(roundId)], refresh)
	onScopeDispose(() => {
		alive = false
		stop()
	})
	return { contest, submission, loading, saving, error, refresh, save, withdraw }
}
