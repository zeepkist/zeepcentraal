import type { SessionUser } from '~/types/app'
import { hasCompleteWebAuthCookieTuple } from '../../shared/authCookies'

export async function useCurrentUser() {
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const responseCookies = import.meta.server ? useResponseHeader('set-cookie') : null
	const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
	const user = computed(() => session.user)
	const shouldResolve = import.meta.server
		? hasCompleteWebAuthCookieTuple(requestHeaders?.cookie)
		: !session.resolved
	if (!shouldResolve) {
		session.pending = false
		session.resolved = true
		installRefreshTimer(async () => {
			const resolved = await $fetch<{
				user: SessionUser | null
				refreshAt: number | null
			}>('/api/session', { credentials: 'include' })
			session.setUser(resolved.user)
			refreshAt.value = resolved.refreshAt
		})
		return { refresh: async () => {}, user }
	}
	// OAuth callbacks are cross-site navigations. Avoid proxying their Sec-Fetch-Site header
	// into the same-origin internal session endpoint; forward only the auth cookie tuple.
	const request = useFetch<{
		user: SessionUser | null
		refreshAt: number | null
	}>('/api/session', {
		credentials: 'include',
		$fetch: import.meta.server ? globalThis.$fetch : undefined,
		headers: requestHeaders,
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
			const existing = Array.isArray(current)
				? current.map(String)
				: current == null
					? []
					: [String(current)]
			responseCookies.value = [...existing, ...cookies]
		},
	})
	const { data, pending, refresh } = request

	function applySession() {
		session.pending = pending.value
		session.setUser(data.value?.user ?? null)
		refreshAt.value = data.value?.refreshAt ?? null
		if (!pending.value) session.resolved = true
	}

	watchEffect(applySession)

	installRefreshTimer(async () => {
		await refresh()
		applySession()
	})

	function installRefreshTimer(refreshUser: () => Promise<void>) {
		if (!import.meta.client) return
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
					if (refreshed) await refreshUser()
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
	applySession()
	return { refresh, user }
}
