import { mergeRequestCookies } from '~/utils/requestCookies'

/** Request-local cookies only. Never serialize credentials into Nuxt payload state. */
export function useAuthRequestCookies() {
	const original = import.meta.server ? useRequestHeaders(['cookie']) : undefined
	const issued = import.meta.server ? useResponseHeader('set-cookie') : undefined
	const cacheControl = import.meta.server ? useResponseHeader('cache-control') : undefined
	function cookies() {
		const current = issued?.value
		return Array.isArray(current)
			? current.map(String)
			: current == null
				? []
				: [String(current)]
	}
	return {
		headers() {
			if (!issued) return undefined
			const cookie = mergeRequestCookies(original?.cookie, cookies())
			if (cookie && cacheControl) cacheControl.value = 'private, no-store'
			return { cookie }
		},
		forward(headers: Headers) {
			if (!issued) return
			const next = headers.getSetCookie()
			if (next.length) issued.value = [...cookies(), ...next]
		},
	}
}
