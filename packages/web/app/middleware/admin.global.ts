export default defineNuxtRouteMiddleware(async (to) => {
	if (!to.path.toLowerCase().startsWith('/admin')) return

	const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
	const responseCookies = import.meta.server ? useResponseHeader('set-cookie') : null
	try {
		// Forward only cookies during SSR. Cross-site navigation headers must not
		// make the internal session lookup appear to be a cross-origin API request.
		const response = await $fetch.raw<{ isAdmin: boolean }>('/api/session', {
			headers,
			credentials: 'include',
		})
		if (responseCookies) {
			const cookies = response.headers.getSetCookie()
			if (cookies.length) {
				const current = responseCookies.value
				const existing = Array.isArray(current)
					? current.map(String)
					: current == null
						? []
						: [String(current)]
				responseCookies.value = [...existing, ...cookies]
			}
		}
		if (response._data?.isAdmin === true) return
	} catch {
		// Failed session checks deny access, including revoked or expired sessions.
	}
	return navigateTo('/', { replace: true })
})
