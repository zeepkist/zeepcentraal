import type { SessionUser } from '~/types/app'

export function useAuthCallbackVerification(isCallback: boolean) {
	const route = useRoute()
	const router = useRouter()
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const verificationFailed = ref(false)
	const { consume: consumeAuthReturnPath } = useAuthReturnPath()

	onMounted(async () => {
		if (!isCallback) return
		const returnPath = consumeAuthReturnPath()
		if (!session.user) {
			session.pending = true
			try {
				const result = await $fetch<{
					user: SessionUser | null
					refreshAt: number | null
				}>('/api/session', { credentials: 'include' })
				session.setUser(result.user)
				refreshAt.value = result.refreshAt
			} catch {
				session.setUser(null)
				refreshAt.value = null
			} finally {
				session.pending = false
			}
		}

		verificationFailed.value = shouldShowAuthVerificationFailure(
			true,
			session.pending,
			Boolean(session.user),
		)
		if (session.user && returnPath) {
			await router.replace(returnPath)
			return
		}
		const query = { ...route.query }
		delete query.auth
		await router.replace({ query })
	})

	return { verificationFailed }
}
