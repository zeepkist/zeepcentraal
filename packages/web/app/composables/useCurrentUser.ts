import type { SessionUser } from '~/types/app'

export async function useCurrentUser() {
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const { data, pending, refresh } = await useFetch<{
		user: SessionUser | null
		refreshAt: number | null
	}>('/api/session', { credentials: 'include' })

	watchEffect(() => {
		session.pending = pending.value
		session.setUser(data.value?.user ?? null)
		refreshAt.value = data.value?.refreshAt ?? null
	})

	if (import.meta.client) {
		let timer: ReturnType<typeof setTimeout> | undefined
		watch(
			refreshAt,
			(next) => {
				if (timer) clearTimeout(timer)
				if (!next || !session.user) return
				const delay = Math.max(0, next - Date.now())
				timer = setTimeout(async () => {
					const refreshed = await $fetch<{ refreshAt: number | null }>(
						'/api/auth/refresh',
						{ method: 'POST', credentials: 'include' },
					).catch(() => null)
					refreshAt.value = refreshed?.refreshAt ?? null
					if (refreshed) await refresh()
				}, delay)
			},
			{ immediate: true },
		)
		onScopeDispose(() => {
			if (timer) clearTimeout(timer)
		})
	}

	return { refresh, user: computed(() => session.user) }
}
