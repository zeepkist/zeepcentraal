import { useSessionRequest } from '../composables/useSessionRequest'

export default defineNuxtRouteMiddleware(async (to) => {
	if (!to.path.toLowerCase().startsWith('/admin')) return
	const load = useSessionRequest()
	try {
		const session = await load()
		if (session.isAdmin === true) return
	} catch {
		// Failed session checks deny access, including revoked or expired sessions.
	}
	return navigateTo('/', { replace: true })
})
