import type { LevelSubmission, SubmissionContest } from '~/utils/superLeagueSubmission'
import { submissionProcessing } from '~/utils/superLeagueSubmission'

export function useSuperLeagueSubmission(roundId: MaybeRef<number | undefined>) {
	const config = useRuntimeConfig()
	const session = useSessionStore()
	const read = useSuperLeagueRead<{
		contest: SubmissionContest | null
		submission: LevelSubmission | null
	}>('submit-level', roundId)
	const contest = computed(() => read.data.value?.contest ?? null)
	const submission = shallowRef<LevelSubmission | null>(null)
	const loading = read.pending
	const saving = ref(false)
	const actionError = ref<string | null>(null)
	const error = computed(() => actionError.value ?? read.error.value)
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
		if (
			!import.meta.server &&
			alive &&
			session.user &&
			submissionProcessing(submission.value?.status)
		)
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
				if (pollError) actionError.value = null
				pollError = false
			}
		} catch {
			if (current === generation) {
				actionError.value = 'Could not check your submission. Trying again…'
				pollError = true
			}
		}
		if (current === generation) schedule()
	}
	async function refresh() {
		stop()
		actionError.value = null
		await read.refresh()
	}
	watch(
		read.data,
		(result) => {
			stop()
			submission.value = result?.submission ?? null
			schedule()
		},
		{ immediate: true },
	)
	async function save(workshopId: string, authors: string[]) {
		if (!contest.value || saving.value) return
		stop()
		const owner = session.user?.id
		const requestedRound = toValue(roundId)
		const current = () =>
			alive && owner === session.user?.id && requestedRound === toValue(roundId)
		saving.value = true
		actionError.value = null
		try {
			await $fetch<number>(endpoint('submit-level'), {
				method: 'POST',
				credentials: 'include',
				body: { roundId: contest.value.roundId, workshopId, authors },
			})
			if (current()) await refresh()
		} catch (cause) {
			const detail = (cause as { data?: { detail?: string } }).data?.detail
			if (current())
				actionError.value = detail ?? 'Could not save your submission. Please try again.'
		} finally {
			saving.value = false
			schedule()
		}
	}
	async function withdraw() {
		if (!contest.value || saving.value) return
		stop()
		const owner = session.user?.id
		const requestedRound = toValue(roundId)
		const current = () =>
			alive && owner === session.user?.id && requestedRound === toValue(roundId)
		saving.value = true
		try {
			await $fetch(endpoint('submit-level'), {
				method: 'DELETE',
				credentials: 'include',
				query: { roundId: contest.value.roundId },
			})
			if (current()) await refresh()
		} catch {
			if (current()) actionError.value = 'Could not withdraw your submission.'
		} finally {
			saving.value = false
			schedule()
		}
	}
	onMounted(schedule)
	watch(
		[() => session.user?.id, () => toValue(roundId)],
		() => {
			stop()
			submission.value = null
			actionError.value = null
		},
		{ flush: 'sync' },
	)
	onScopeDispose(() => {
		alive = false
		stop()
	})
	return {
		contest,
		submission,
		loading,
		resolved: read.resolved,
		initial: read.initial,
		saving,
		error,
		refresh,
		save,
		withdraw,
	}
}
