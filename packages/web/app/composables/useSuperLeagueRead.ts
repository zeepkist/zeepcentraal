import { mergeRequestCookies } from '~/utils/requestCookies'

/** Private, request-scoped SSR data. The envelope distinguishes an empty response from unresolved data. */
export function useSuperLeagueRead<T>(
	kind: 'vote' | 'submit-level',
	roundId: MaybeRef<number | undefined>,
) {
	const session = useSessionStore()
	const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
	const responseCookies = import.meta.server ? useResponseHeader('set-cookie') : undefined
	if (import.meta.server) useResponseHeader('cache-control').value = 'private, no-store'
	const identity = computed(
		() => `zsl-${kind}:${session.user?.id ?? 'guest'}:${toValue(roundId) ?? 'current'}`,
	)
	const request = useAsyncData(
		identity,
		async (_app, { signal }) => {
			const owner = identity.value
			if (!session.user) return { owner, result: null as T | null }
			const issued = responseCookies?.value
			const headers = import.meta.server
				? {
						cookie: mergeRequestCookies(
							requestHeaders?.cookie,
							Array.isArray(issued)
								? issued.map(String)
								: issued
									? [String(issued)]
									: [],
						),
					}
				: undefined
			const response = await $fetch.raw<T>(`/api/super-league/${kind}`, {
				credentials: 'include',
				query: { roundId: toValue(roundId) },
				headers,
				signal,
			})
			if (responseCookies) {
				const cookies = response.headers.getSetCookie()
				if (cookies.length) {
					const current = responseCookies.value
					responseCookies.value = [
						...(Array.isArray(current)
							? current.map(String)
							: current
								? [String(current)]
								: []),
						...cookies,
					]
				}
			}
			return { owner, result: response._data ?? null }
		},
		{ server: true, lazy: true },
	)
	const lastResult = shallowRef<typeof request.data.value>()
	watch(
		request.data,
		(value) => {
			if (value?.owner === identity.value) lastResult.value = value
		},
		{ immediate: true, flush: 'sync' },
	)
	const snapshot = computed(() => request.data.value ?? lastResult.value)
	const matches = computed(() => snapshot.value?.owner === identity.value)
	const data = computed(() =>
		session.user && matches.value ? (snapshot.value?.result ?? null) : null,
	)
	const resolved = computed(() => matches.value && request.status.value !== 'idle')
	const pending = computed(
		() =>
			session.pending ||
			!session.resolved ||
			(!!session.user && !matches.value && request.status.value !== 'error'),
	)
	const error = computed(() => request.error.value?.message ?? null)
	watch(
		identity,
		(_next, previous) => {
			lastResult.value = undefined
			clearNuxtData(previous)
		},
		{ flush: 'sync' },
	)
	return { data, pending, resolved, error, refresh: request.refresh, initial: request }
}
