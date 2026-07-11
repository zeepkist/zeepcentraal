import type { SessionUser } from '~/types/app'

export async function useCurrentUser() {
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const responseCookies = import.meta.server ? useResponseHeader('set-cookie') : null
	const request = useFetch<{
		user: SessionUser | null
		refreshAt: number | null
	}>('/api/session', {
		credentials: 'include',
		key: 'current-user',
		onResponse({ response }) {
			if (!responseCookies) return
			const cookies =
				(
					response.headers as Headers & { getSetCookie?: () => string[] }
				).getSetCookie?.() ??
				(response.headers.get('set-cookie')
					? [response.headers.get('set-cookie') as string]
					: [])
			if (cookies.length === 0) return
			const current = responseCookies.value
			const existing = Array.isArray(current) ? current : current ? [current] : []
			responseCookies.value = [...existing, ...cookies]
		},
	})
	const { data, pending, refresh } = request
	const user = computed(() => session.user)

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
					else session.setUser(null)
				}, delay)
			},
			{ immediate: true },
		)
		onScopeDispose(() => {
			if (timer) clearTimeout(timer)
		})
	}

	await request
	return { refresh, user }
}
