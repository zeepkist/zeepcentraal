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
		await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
		session.setUser(null)
		refreshAt.value = null
		await navigateTo('/')
	}

	return { login, logout }
}
