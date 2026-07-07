import type { SessionUser } from '~/types/app'

export async function useCurrentUser() {
	const session = useSessionStore()
	const { data, pending, refresh } = await useFetch<{
		user: SessionUser | null
	}>('/api/session', {
		credentials: 'include',
	})

	watchEffect(() => {
		session.pending = pending.value
		session.setUser(data.value?.user ?? null)
	})

	return {
		refresh,
		user: computed(() => session.user),
	}
}
