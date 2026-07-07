import { defineStore } from 'pinia'
import type { SessionUser } from '~/types/app'

export const useSessionStore = defineStore('session', () => {
	const user = ref<SessionUser | null>(null)
	const pending = ref(false)

	function setUser(nextUser: SessionUser | null) {
		user.value = nextUser
	}

	return {
		pending,
		setUser,
		user,
	}
})
