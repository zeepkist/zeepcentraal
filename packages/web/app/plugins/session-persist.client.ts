import type { SessionUser } from '~/types/app'

const storageKey = 'zeepcentraal_session'

export default defineNuxtPlugin(() => {
	const session = useSessionStore()
	try {
		const stored = localStorage.getItem(storageKey)
		if (stored) session.setUser(JSON.parse(stored) as SessionUser)
	} catch {
		localStorage.removeItem(storageKey)
	}
	session.$subscribe(
		(_mutation, state) => {
			if (state.user) localStorage.setItem(storageKey, JSON.stringify(state.user))
			else localStorage.removeItem(storageKey)
		},
		{ detached: true },
	)
})
