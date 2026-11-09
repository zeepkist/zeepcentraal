import { hasRefreshableWebAuthCookieTuple } from '#shared/authCookies'
import { useSessionRecovery } from './useSessionRecovery'
import { useSessionRequest } from './useSessionRequest'

export async function useCurrentUser() {
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const load = useSessionRequest()
	const user = computed(() => session.user)
	watch(
		() => session.user?.id,
		(_next, previous) => {
			if (previous === undefined) return
			clearNuxtData(
				(key) =>
					key.startsWith(`zsl-vote:${previous}:`) ||
					key.startsWith(`zsl-submit-level:${previous}:`),
			)
		},
		{ flush: 'sync' },
	)
	const recovery = useSessionRecovery(session, refreshAt, load)
	if (import.meta.client) recovery.listen()
	const shouldResolve = import.meta.server
		? hasRefreshableWebAuthCookieTuple(useRequestHeaders(['cookie']).cookie)
		: !session.resolved
	if (shouldResolve) await recovery.refresh()
	else {
		session.pending = false
		session.resolved = true
	}
	return { refresh: recovery.refresh, user }
}
