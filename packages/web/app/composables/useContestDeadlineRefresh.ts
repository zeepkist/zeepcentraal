import { nextContestDeadline } from '~/utils/superLeagueVoteResults'

/** Refresh on publication boundaries and when a suspended tab becomes active. */
export function useContestDeadlineRefresh(
	deadlines: MaybeRef<readonly (string | null | undefined)[]>,
	refresh: () => Promise<unknown>,
) {
	if (!import.meta.client) return
	let timer: ReturnType<typeof setTimeout> | undefined
	let running = false
	let disposed = false
	function schedule() {
		if (timer) clearTimeout(timer)
		if (disposed) return
		const delay = nextContestDeadline(toValue(deadlines), Date.now())
		if (delay !== null) timer = setTimeout(() => void update(), delay)
	}
	async function update() {
		if (running || disposed || document.visibilityState === 'hidden') return
		running = true
		try {
			await refresh()
		} finally {
			running = false
			schedule()
		}
	}
	const onFocus = () => void update()
	onMounted(() => {
		schedule()
		window.addEventListener('focus', onFocus)
		document.addEventListener('visibilitychange', onFocus)
	})
	watch(() => toValue(deadlines), schedule)
	onScopeDispose(() => {
		disposed = true
		if (timer) clearTimeout(timer)
		window.removeEventListener('focus', onFocus)
		document.removeEventListener('visibilitychange', onFocus)
	})
}
