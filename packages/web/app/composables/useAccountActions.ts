export function useAccountActions() {
	const config = useRuntimeConfig()
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)

	function login(provider: 'steam' | 'discord') {
		const url =
			provider === 'steam'
				? steamRedirectUrl(config.public.backendUrl)
				: discordRedirectUrl(config.public.backendUrl)
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
