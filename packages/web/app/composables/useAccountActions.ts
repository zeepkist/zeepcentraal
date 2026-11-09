export function useAccountActions() {
	const config = useRuntimeConfig()
	const route = useRoute()
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const { save: saveAuthReturnPath } = useAuthReturnPath()

	function login(provider: 'steam' | 'discord') {
		const url =
			provider === 'steam'
				? steamRedirectUrl(config.public.backendUrl)
				: discordRedirectUrl(config.public.backendUrl)
		saveAuthReturnPath(route.fullPath)
		return navigateTo(url, { external: true })
	}

	async function logout() {
		session.loggingOut = true
		session.invalidate()
		refreshAt.value = null
		try {
			// Let rotation responses settle before clearing cookies, so logout wins.
			await session.waitForSessionRefresh()
			await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
			await navigateTo('/')
		} finally {
			session.loggingOut = false
		}
	}

	return { login, logout }
}
