import { useSessionRecovery } from './useSessionRecovery'
import { useSessionRequest } from './useSessionRequest'

export function useAuthCallbackVerification(isCallback: boolean) {
	const route = useRoute()
	const router = useRouter()
	const session = useSessionStore()
	const refreshAt = useState<number | null>('session-refresh-at', () => null)
	const verificationFailed = ref(false)
	const { consume: consumeAuthReturnPath } = useAuthReturnPath()
	const recovery = useSessionRecovery(session, refreshAt, useSessionRequest())

	onMounted(async () => {
		if (!isCallback) return
		const revision = session.revision
		const returnPath = consumeAuthReturnPath()
		if (!session.user) {
			await recovery.refresh()
		}
		if (revision !== session.revision) return

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
