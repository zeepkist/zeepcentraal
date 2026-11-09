import type { SessionUser } from '~/types/app'
import { useAuthRequestCookies } from './useAuthRequestCookies'

export type WebSession = {
	user: SessionUser | null
	isAdmin: boolean
	refreshAt: number | null
}

/** Keep rotated cookies on the SSR response and reuse them within this request. */
export function useSessionRequest() {
	const cookies = useAuthRequestCookies()
	return async () => {
		// Do not forward cross-site navigation headers into this internal request.
		const response = await $fetch.raw<WebSession>('/api/session', {
			credentials: 'include',
			headers: cookies.headers(),
			retry: 0,
		})
		cookies.forward(response.headers)
		if (!response._data) throw new Error('Session response missing')
		return response._data
	}
}
