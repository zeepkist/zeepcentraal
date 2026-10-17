import { createError, getRequestHeader, getRequestURL, type RequestEvent } from 'nuxt/server'
export function isCrossOriginRequest(
	origin: string | undefined,
	fetchSite: string | undefined,
	requestOrigin: string,
) {
	return fetchSite === 'cross-site' || Boolean(origin && origin !== requestOrigin)
}

export function assertSameOrigin(event: RequestEvent) {
	if (
		isCrossOriginRequest(
			getRequestHeader(event, 'origin'),
			getRequestHeader(event, 'sec-fetch-site'),
			getRequestURL(event).origin,
		)
	) {
		throw createError({
			status: 403,
			statusText: 'Cross-origin API requests are not allowed',
		})
	}
}
