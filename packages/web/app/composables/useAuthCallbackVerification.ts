import type { SessionUser } from '~/types/app'

export function useAuthCallbackVerification(isCallback: boolean) {
	const route = useRoute()
	const router = useRouter()
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const verificationFailed = ref(false)

	onMounted(async () => {
		if (!isCallback) return
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
		const query = { ...route.query }
		delete query.auth
		await router.replace({ query })
	})

	return { verificationFailed }
}
