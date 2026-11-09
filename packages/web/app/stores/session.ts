import { defineStore } from 'pinia'
import type { SessionUser } from '~/types/app'

export const useSessionStore = defineStore('session', () => {
	const user = ref<SessionUser | null>(null)
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
		user.value = null
		pending.value = false
		resolved.value = true
	}

	function setUser(nextUser: SessionUser | null) {
		user.value = nextUser
	}

	return {
		invalidate,
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
