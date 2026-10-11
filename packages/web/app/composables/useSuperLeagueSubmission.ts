import type { LevelSubmission, SubmissionContest } from '~/utils/superLeagueSubmission'
import { submissionProcessing } from '~/utils/superLeagueSubmission'

export function useSuperLeagueSubmission(roundId: MaybeRef<number | undefined>) {
	const config = useRuntimeConfig()
	const overview = useSuperLeagueSubmissionOverview(roundId)
	const session = useSessionStore()
	const viewerRoundId = computed(() => toValue(roundId) ?? overview.data.value?.contest?.roundId)
	const read = useSuperLeagueRead<{
		contest: SubmissionContest | null
		submission: LevelSubmission | null
	}>('submit-level', viewerRoundId)
	const contest = computed(() => overview.data.value?.contest ?? read.data.value?.contest ?? null)
	const submission = shallowRef<LevelSubmission | null>(null)
	const loading = computed(() => !contest.value && overview.pending.value)
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
				const wasProcessing = submissionProcessing(submission.value?.status)
				submission.value = next
				if (wasProcessing && !submissionProcessing(next.status)) await overview.refresh()
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
		await Promise.all([read.refresh(), overview.refresh()])
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
		resolved: computed(() => !overview.pending.value),
		initial: Promise.all([read.initial, overview.initial]),
		overview: overview.data,
		overviewError: computed(() => overview.error.value?.message ?? null),
		refreshOverview: overview.refresh,
		saving,
		error,
		refresh,
		save,
		withdraw,
	}
}
