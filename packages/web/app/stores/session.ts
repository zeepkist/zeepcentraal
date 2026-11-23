import { defineStore } from 'pinia'
import type { SessionUser } from '~/types/app'

export const useSessionStore = defineStore('session', () => {
	const user = ref<SessionUser | null>(null)
	const isAdmin = ref(false)
	const pending = ref(false)
	const resolved = ref(false)
	const revision = ref(0)
	const loggingOut = ref(false)
	let activeRefresh: Promise<void> | undefined

	function refreshSession(operation: () => Promise<void>) {
		if (!activeRefresh) {
			activeRefresh = Promise.resolve()
				.then(operation)
				.finally(() => {
					activeRefresh = undefined
				})
		}
		return activeRefresh
	}

	async function waitForSessionRefresh() {
		await activeRefresh
	}

	function invalidate() {
		revision.value += 1
		setUser(null)
		pending.value = false
		resolved.value = true
	}

	function setUser(
		nextUser: SessionUser | null,
		admin = user.value?.id === nextUser?.id && isAdmin.value,
	) {
		user.value = nextUser
		isAdmin.value = nextUser !== null && admin === true
	}

	return {
		invalidate,
		isAdmin,
		loggingOut,
		pending,
		refreshSession,
		revision,
		resolved,
		setUser,
		user,
		waitForSessionRefresh,
	}
})
